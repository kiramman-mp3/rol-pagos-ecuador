import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { Decimal } from "decimal.js";

import { calcularRol } from "../calculos.ts";
import type { ResultadoRol } from "../calculos.ts";
import {
  aSnake, consultar, ejecutar, filaACamel, transaccion, uno,
} from "../db.ts";
import type { Fila } from "../db.ts";
import { parametrosDelAnio } from "../parametros.ts";
import { reglasDe } from "../reglas.ts";
import { aDecimal, ErrorApi } from "../validaciones.ts";

const CAMPOS_NOVEDAD = [
  "horas50", "horas100", "horasNocturnas", "comisiones", "otrosDescuentos",
] as const;
type Novedad = Record<(typeof CAMPOS_NOVEDAD)[number], Decimal>;

function leerPeriodo(anioTexto: unknown, mesTexto: unknown): { anio: number; mes: number } {
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || anio < 2020 || anio > 2100 || mes < 1 || mes > 12) {
    throw new ErrorApi(400, ["Período inválido."]);
  }
  return { anio, mes };
}

/** Activos que ya habían ingresado al cierre del mes (las fechas ISO se comparan como texto). */
function empleadosDelPeriodo(db: DatabaseSync, anio: number, mes: number): Fila[] {
  return consultar(
    db,
    "SELECT * FROM empleados WHERE activo = 1 AND fecha_ingreso <= ? ORDER BY nombres",
    `${anio}-${String(mes).padStart(2, "0")}-31`,
  );
}

const existeRol = (db: DatabaseSync, anio: number, mes: number) =>
  uno(db, "SELECT 1 AS ok FROM roles_cabecera WHERE anio = ? AND mes = ?", anio, mes) !== undefined;

/** Calcula y guarda todo en una sola transacción; reemplaza el rol del mes si existía. */
function guardarRol(
  db: DatabaseSync, anio: number, mes: number,
  empleados: Fila[], novedades: Map<number, Novedad>,
): number {
  const cero = new Decimal(0);
  const reglas = reglasDe(parametrosDelAnio(db, anio).parametros);
  const calculos = empleados.map((e) => {
    const n = novedades.get(Number(e.id));
    const resultado = calcularRol({
      sueldoBase: String(e.sueldo_base),
      fechaIngreso: String(e.fecha_ingreso),
      anio, mes,
      horas50: n?.horas50 ?? cero,
      horas100: n?.horas100 ?? cero,
      horasNocturnas: n?.horasNocturnas ?? cero,
      comisiones: n?.comisiones ?? cero,
      otrosDescuentos: n?.otrosDescuentos ?? cero,
    }, reglas);
    return { e, resultado, n };
  });

  const total = (campo: keyof ResultadoRol) =>
    calculos.reduce((suma, c) => suma.plus(c.resultado[campo]), cero).toNumber();

  return transaccion(db, () => {
    ejecutar(db, "DELETE FROM roles_cabecera WHERE anio = ? AND mes = ?", anio, mes);
    const rolId = Number(
      ejecutar(
        db,
        `INSERT INTO roles_cabecera (anio, mes, generado_en, num_empleados, total_ingresos,
         total_descuentos, total_neto, total_provisiones, total_costo)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        anio, mes, new Date().toISOString().slice(0, 19), calculos.length,
        total("totalIngresos"), total("totalDescuentos"), total("netoPagar"),
        total("totalProvisiones"), total("costoEmpleador"),
      ).lastInsertRowid,
    );

    for (const { e, resultado, n } of calculos) {
      const fila: Fila = {
        rol_id: rolId, empleado_id: Number(e.id), cedula: e.cedula, nombres: e.nombres,
        cargo: e.cargo, sueldo_base: e.sueldo_base, fecha_ingreso: e.fecha_ingreso,
        ...Object.fromEntries(Object.entries(resultado).map(([k, v]) => [aSnake(k), v])),
      };
      const columnas = Object.keys(fila);
      ejecutar(
        db,
        `INSERT INTO roles_detalle (${columnas.join(", ")})
         VALUES (${columnas.map(() => "?").join(", ")})`,
        ...Object.values(fila),
      );
      ejecutar(
        db,
        `INSERT OR REPLACE INTO novedades (empleado_id, anio, mes, horas_50, horas_100,
         horas_nocturnas, comisiones, otros_descuentos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        Number(e.id), anio, mes,
        ...CAMPOS_NOVEDAD.map((campo) => (n?.[campo] ?? cero).toNumber()),
      );
    }
    return rolId;
  });
}

const COLUMNAS_CSV = [
  "cedula", "nombres", "cargo", "sueldo", "valor_horas_50", "valor_horas_100",
  "valor_recargo_nocturno", "comisiones", "total_ingresos", "aporte_iess", "impuesto_renta",
  "otros_descuentos", "total_descuentos", "neto_pagar", "decimo_tercero", "decimo_cuarto",
  "vacaciones", "fondos_reserva", "aporte_patronal", "costo_empleador",
];

// Excel abre el CSV en UTF-8 solo si empieza con esta marca.
const BOM = String.fromCharCode(0xfeff);

const celdaCsv = (valor: unknown) => {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
};

export function rutasRoles(db: DatabaseSync): Router {
  const router = Router();

  const cargar = (idTexto: string) => {
    const cabecera = uno(db, "SELECT * FROM roles_cabecera WHERE id = ?", Number(idTexto));
    if (!cabecera) throw new ErrorApi(404, ["El rol no existe."]);
    const detalle = consultar(
      db, "SELECT * FROM roles_detalle WHERE rol_id = ? ORDER BY nombres", Number(cabecera.id),
    );
    return { cabecera, detalle };
  };

  router.get("/", (_req, res) => {
    res.json(
      consultar(db, "SELECT * FROM roles_cabecera ORDER BY anio DESC, mes DESC").map(filaACamel),
    );
  });

  /** Empleados que entrarán al rol del mes y las novedades que ya se habían digitado. */
  router.get("/periodo/:anio/:mes", (req, res) => {
    const { anio, mes } = leerPeriodo(req.params.anio, req.params.mes);
    const guardadas = new Map(
      consultar(db, "SELECT * FROM novedades WHERE anio = ? AND mes = ?", anio, mes)
        .map((n) => [Number(n.empleado_id), n]),
    );
    res.json({
      anio, mes,
      existe: existeRol(db, anio, mes),
      empleados: empleadosDelPeriodo(db, anio, mes).map((e) => {
        const g = guardadas.get(Number(e.id));
        return {
          id: e.id, nombres: e.nombres, cargo: e.cargo, sueldoBase: e.sueldo_base,
          novedades: {
            horas50: g?.horas_50 ?? 0,
            horas100: g?.horas_100 ?? 0,
            horasNocturnas: g?.horas_nocturnas ?? 0,
            comisiones: g?.comisiones ?? 0,
            otrosDescuentos: g?.otros_descuentos ?? 0,
          },
        };
      }),
    });
  });

  router.post("/generar", (req, res) => {
    const cuerpo = req.body ?? {};
    const { anio, mes } = leerPeriodo(cuerpo.anio, cuerpo.mes);
    const empleados = empleadosDelPeriodo(db, anio, mes);
    if (!empleados.length) throw new ErrorApi(400, ["No hay empleados activos para ese período."]);

    const errores: string[] = [];
    const novedades = new Map<number, Novedad>();
    const enviadas: Record<string, unknown>[] = Array.isArray(cuerpo.novedades) ? cuerpo.novedades : [];
    for (const e of empleados) {
      const enviada = enviadas.find((n) => Number(n.empleadoId) === Number(e.id)) ?? {};
      try {
        novedades.set(
          Number(e.id),
          Object.fromEntries(CAMPOS_NOVEDAD.map((c) => [c, aDecimal(enviada[c])])) as Novedad,
        );
      } catch (error) {
        errores.push(`${e.nombres}: ${(error as Error).message}.`);
      }
    }
    if (errores.length) throw new ErrorApi(400, errores);

    const id = guardarRol(db, anio, mes, empleados, novedades);
    res.status(201).json({ id, empleados: empleados.length });
  });

  router.get("/:id", (req, res) => {
    const { cabecera, detalle } = cargar(req.params.id);
    res.json({ ...filaACamel(cabecera), detalle: detalle.map(filaACamel) });
  });

  router.get("/:id/csv", (req, res) => {
    const { cabecera, detalle } = cargar(req.params.id);
    const lineas = [COLUMNAS_CSV.join(",")];
    for (const d of detalle) lineas.push(COLUMNAS_CSV.map((c) => celdaCsv(d[c])).join(","));
    const nombre = `rol_${cabecera.anio}_${String(cabecera.mes).padStart(2, "0")}.csv`;
    res
      .type("text/csv; charset=utf-8")
      .set("Content-Disposition", `attachment; filename=${nombre}`)
      .send(`${BOM}${lineas.join("\n")}\n`);
  });

  router.delete("/:id", (req, res) => {
    const { cabecera } = cargar(req.params.id);
    ejecutar(db, "DELETE FROM roles_cabecera WHERE id = ?", Number(cabecera.id));
    res.status(204).end();
  });

  return router;
}
