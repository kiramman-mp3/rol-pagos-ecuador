import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { Decimal } from "decimal.js";

import { avisoHorasIgnoradas, avisosDeTopes, calcularRol } from "../calculos.ts";
import type { ResultadoRol } from "../calculos.ts";
import {
  aSnake, consultar, ejecutar, filaACamel, transaccion, uno,
} from "../db.ts";
import type { Fila } from "../db.ts";
import { parametrosDelAnio } from "../parametros.ts";
import { indexarRegimenes, listarRegimenes, opcionesDe, regimenAplicado, reglasDe } from "../regimenes.ts";
import { documentoCsv } from "../csv.ts";
import { planillaIess } from "../iess.ts";
import { aDecimal, ErrorApi } from "../validaciones.ts";

const CAMPOS_NOVEDAD = [
  "horasSuplementarias", "horasExtraordinarias", "horasDescanso", "horasNocturnas",
  "comisiones", "otrosDescuentos",
] as const;
type Novedad = Record<(typeof CAMPOS_NOVEDAD)[number], Decimal>;
const COLUMNAS_NOVEDAD = CAMPOS_NOVEDAD.map(aSnake);

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
): { rolId: number; avisos: string[] } {
  const cero = new Decimal(0);
  const { parametros, exacto } = parametrosDelAnio(db, anio);
  const regimenes = indexarRegimenes(listarRegimenes(db));
  const calculos = empleados.map((e) => {
    const n = novedades.get(Number(e.id));
    const aplicado = regimenAplicado(regimenes, String(e.regimen), e.categoria_loep as string | null);
    const reglas = reglasDe(parametros, aplicado);
    const opciones = opcionesDe(aplicado, e);
    const resultado = calcularRol({
      sueldoBase: String(e.sueldo_base),
      fechaIngreso: String(e.fecha_ingreso),
      anio, mes,
      horasSuplementarias: n?.horasSuplementarias ?? cero,
      horasExtraordinarias: n?.horasExtraordinarias ?? cero,
      horasDescanso: n?.horasDescanso ?? cero,
      horasNocturnas: n?.horasNocturnas ?? cero,
      comisiones: n?.comisiones ?? cero,
      otrosDescuentos: n?.otrosDescuentos ?? cero,
    }, reglas, opciones);
    return { e, resultado, n, aplicado, reglas, opciones };
  });

  const avisos = calculos.flatMap(({ e, n, reglas, opciones }) => {
    if (!n) return [];
    const nombre = String(e.nombres);
    return opciones.recibeHorasExtras ? avisosDeTopes(nombre, n, reglas) : avisoHorasIgnoradas(nombre, n);
  });
  if (!exacto) avisos.unshift(`No hay parámetros de ${anio}; se usaron los de ${parametros.anio}.`);

  const total = (campo: keyof ResultadoRol) =>
    calculos.reduce((suma, c) => suma.plus(c.resultado[campo]), cero).toNumber();

  const rolId = transaccion(db, () => {
    ejecutar(db, "DELETE FROM roles_cabecera WHERE anio = ? AND mes = ?", anio, mes);
    const nuevoId = Number(
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

    for (const { e, resultado, n, aplicado } of calculos) {
      const fila: Fila = {
        rol_id: nuevoId, empleado_id: Number(e.id), cedula: e.cedula, nombres: e.nombres,
        cargo: e.cargo, sueldo_base: e.sueldo_base, fecha_ingreso: e.fecha_ingreso,
        regimen: e.regimen, regimen_aplicado: aplicado.codigo,
        tasa_iess_personal: aplicado.iessPersonal, tasa_iess_patronal: aplicado.iessPatronal,
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
        `INSERT OR REPLACE INTO novedades (empleado_id, anio, mes, ${COLUMNAS_NOVEDAD.join(", ")})
         VALUES (?, ?, ?, ${COLUMNAS_NOVEDAD.map(() => "?").join(", ")})`,
        Number(e.id), anio, mes,
        ...CAMPOS_NOVEDAD.map((campo) => (n?.[campo] ?? cero).toNumber()),
      );
    }
    return nuevoId;
  });
  return { rolId, avisos };
}

const COLUMNAS_CSV = [
  "cedula", "nombres", "cargo", "regimen_aplicado", "sueldo", "valor_horas_suplementarias",
  "valor_horas_extraordinarias", "valor_horas_descanso", "valor_recargo_nocturno", "comisiones",
  "ingresos_aportables", "beneficios_mensuales", "total_ingresos", "aporte_iess", "impuesto_renta",
  "otros_descuentos", "total_descuentos", "neto_pagar", "decimo_tercero", "decimo_tercero_modalidad",
  "decimo_cuarto", "decimo_cuarto_modalidad", "fondos_reserva", "fondos_reserva_modalidad",
  "vacaciones", "aporte_patronal", "costo_empleador",
];

const COLUMNAS_IESS = [
  "cedula", "nombres", "regimen", "dias_trabajados", "materia_gravada", "tasa_aporte_personal", "aporte_personal",
  "tasa_aporte_patronal", "aporte_patronal", "total_aportes", "fondos_reserva_a_depositar_en_iess",
  "fondos_reserva_pagados_en_rol",
];

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
    const regimenes = indexarRegimenes(listarRegimenes(db));
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
          regimen: e.regimen,
          regimenAplicado: regimenAplicado(regimenes, String(e.regimen), e.categoria_loep as string | null).codigo,
          recibeHorasExtras: opcionesDe(
            regimenAplicado(regimenes, String(e.regimen), e.categoria_loep as string | null), e,
          ).recibeHorasExtras,
          novedades: {
            horasSuplementarias: g?.horas_suplementarias ?? 0,
            horasExtraordinarias: g?.horas_extraordinarias ?? 0,
            horasDescanso: g?.horas_descanso ?? 0,
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

    const { rolId, avisos } = guardarRol(db, anio, mes, empleados, novedades);
    res.status(201).json({ id: rolId, empleados: empleados.length, avisos });
  });

  router.get("/:id", (req, res) => {
    const { cabecera, detalle } = cargar(req.params.id);
    res.json({ ...filaACamel(cabecera), detalle: detalle.map(filaACamel) });
  });

  router.get("/:id/csv", (req, res) => {
    const { cabecera, detalle } = cargar(req.params.id);
    const nombre = `rol_${cabecera.anio}_${String(cabecera.mes).padStart(2, "0")}.csv`;
    res
      .type("text/csv; charset=utf-8")
      .set("Content-Disposition", `attachment; filename=${nombre}`)
      .send(documentoCsv(COLUMNAS_CSV, detalle.map((d) => COLUMNAS_CSV.map((c) => d[c]))));
  });

  /** Aportes del rol por empleado, para contrastarlos con el comprobante del IESS. */
  router.get("/:id/iess", (req, res) => {
    const { cabecera, detalle } = cargar(req.params.id);
    res.json(planillaIess(Number(cabecera.anio), Number(cabecera.mes), detalle));
  });

  router.get("/:id/iess.csv", (req, res) => {
    const { cabecera, detalle } = cargar(req.params.id);
    const p = planillaIess(Number(cabecera.anio), Number(cabecera.mes), detalle);
    const filas: unknown[][] = p.filas.map((f) => [
      f.cedula, f.nombres, f.regimenAplicado, f.diasTrabajados, f.materiaGravada, f.tasaPersonal,
      f.aportePersonal, f.tasaPatronal, f.aportePatronal, f.totalAportes, f.fondosADepositar, f.fondosPagadosEnRol,
    ]);
    filas.push([
      "TOTAL", "", "", "", p.totales.materiaGravada, "", p.totales.aportePersonal, "", p.totales.aportePatronal,
      p.totales.totalAportes, p.totales.fondosADepositar, p.totales.fondosPagadosEnRol,
    ]);
    const nombre = `iess_${p.anio}_${String(p.mes).padStart(2, "0")}.csv`;
    res
      .type("text/csv; charset=utf-8")
      .set("Content-Disposition", `attachment; filename=${nombre}`)
      .send(documentoCsv(COLUMNAS_IESS, filas));
  });

  router.delete("/:id", (req, res) => {
    const { cabecera } = cargar(req.params.id);
    ejecutar(db, "DELETE FROM roles_cabecera WHERE id = ?", Number(cabecera.id));
    res.status(204).end();
  });

  return router;
}
