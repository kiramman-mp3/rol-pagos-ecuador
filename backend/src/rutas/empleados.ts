import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";

import { CONTRATOS, EMPLEADOS_DEMO } from "../config.ts";
import { MODALIDADES } from "../calculos.ts";
import type { Modalidad } from "../calculos.ts";
import { consultar, ejecutar, filaACamel, uno } from "../db.ts";
import type { Fila } from "../db.ts";
import { parametrosDelAnio } from "../parametros.ts";
import { buscarGrado } from "../escala.ts";
import { CATEGORIAS_LOEP, indexarRegimenes, listarRegimenes, regimenAplicado } from "../regimenes.ts";
import { aDecimal, cedulaValida, ErrorApi, fechaIsoValida } from "../validaciones.ts";

interface DatosEmpleado {
  cedula: string;
  nombres: string;
  cargo: string;
  sueldoBase: number;
  fechaIngreso: string;
  tipoContrato: string;
  regimen: string;
  categoriaLoep: string | null;
  escalaId: number | null;
  /** null = lo que diga el régimen */
  pagoDecimoTercero: Modalidad | null;
  pagoDecimoCuarto: Modalidad | null;
  pagoFondosReserva: Modalidad | null;
  recibeHorasExtras: boolean | null;
}

/** Reglas de negocio del formulario. Devuelve los datos limpios y los avisos no bloqueantes. */
function validar(
  db: DatabaseSync, cuerpo: Record<string, unknown>,
): { datos: DatosEmpleado; avisos: string[] } {
  const texto = (campo: string) => String(cuerpo[campo] ?? "").trim();
  const errores: string[] = [];
  const avisos: string[] = [];

  const cedula = texto("cedula");
  const nombres = texto("nombres");
  const cargo = texto("cargo");
  const tipoContrato = texto("tipoContrato");
  const fechaIngreso = texto("fechaIngreso");
  const regimen = texto("regimen") || "CODIGO_TRABAJO";

  if (!cedulaValida(cedula)) errores.push("La cédula no es válida (10 dígitos, módulo 10).");
  if (!nombres || !cargo) errores.push("Nombres y cargo son obligatorios.");
  if (!CONTRATOS.includes(tipoContrato)) errores.push("Tipo de contrato inválido.");
  if (!fechaIsoValida(fechaIngreso)) errores.push("Fecha de ingreso inválida.");

  // El régimen existe y, si es mixto (LOEP), hace falta saber si es servidor u obrero.
  const elegido = indexarRegimenes(listarRegimenes(db)).get(regimen);
  let categoriaLoep: string | null = null;
  if (!elegido) {
    errores.push("El régimen laboral no existe.");
  } else if (elegido.tipo === "mixto") {
    categoriaLoep = texto("categoriaLoep");
    if (!(CATEGORIAS_LOEP as readonly string[]).includes(categoriaLoep)) {
      errores.push(`${elegido.nombre}: indica si el empleado es servidor u obrero.`);
    }
  }

  // Grado de la escala salarial (opcional): debe ser de la escala del régimen que se aplica.
  let escalaId: number | null = null;
  const pedido = cuerpo.escalaId;
  const grado = pedido === null || pedido === undefined || pedido === "" ? undefined : buscarGrado(db, Number(pedido));
  if (pedido !== null && pedido !== undefined && pedido !== "") {
    let aplicado: string | null = null;
    try {
      aplicado = elegido ? regimenAplicado(indexarRegimenes(listarRegimenes(db)), regimen, categoriaLoep).codigo : null;
    } catch {
      /* la categoría faltante ya quedó reportada arriba */
    }
    if (!grado) errores.push("El grado de la escala salarial no existe.");
    else if (aplicado && grado.regimen !== aplicado) {
      errores.push(`El grado ${grado.grado} es de la escala ${grado.regimen}, no de ${aplicado}.`);
    } else escalaId = grado.id;
  }

  // Opciones de pago: vacío = lo que diga el régimen.
  const modalidad = (campo: string, etiqueta: string): Modalidad | null => {
    const valor = cuerpo[campo];
    if (valor === null || valor === undefined || valor === "") return null;
    if (!MODALIDADES.includes(valor as Modalidad)) {
      errores.push(`${etiqueta}: elige 'no', 'mensual' o 'acumulado'.`);
      return null;
    }
    return valor as Modalidad;
  };
  const pagoDecimoTercero = modalidad("pagoDecimoTercero", "Décimo tercero");
  const pagoDecimoCuarto = modalidad("pagoDecimoCuarto", "Décimo cuarto");
  const pagoFondosReserva = modalidad("pagoFondosReserva", "Fondos de reserva");
  const horas = cuerpo.recibeHorasExtras;
  if (horas !== null && horas !== undefined && horas !== "" && typeof horas !== "boolean") {
    errores.push("Horas extras: indica si las recibe o deja la opción del régimen.");
  }
  const recibeHorasExtras = typeof horas === "boolean" ? horas : null;

  let sueldoBase = 0;
  try {
    sueldoBase = aDecimal(cuerpo.sueldoBase).toNumber();
    if (sueldoBase <= 0) errores.push("El sueldo base debe ser mayor a cero.");
    else {
      // El SBU del año en curso sale de la base, no de una constante.
      const { parametros } = parametrosDelAnio(db, new Date().getFullYear());
      if (sueldoBase < parametros.sbu) {
        avisos.push(`Aviso: el sueldo es menor al SBU ${parametros.anio} ($${parametros.sbu}).`);
      }
      if (grado && escalaId !== null && sueldoBase !== grado.rmu) {
        avisos.push(`Aviso: el sueldo ($${sueldoBase}) difiere de la RMU del grado ${grado.grado} ($${grado.rmu}).`);
      }
    }
  } catch (error) {
    errores.push(`Sueldo base: ${(error as Error).message}.`);
  }

  if (errores.length) throw new ErrorApi(400, errores);
  return {
    datos: {
      cedula, nombres, cargo, sueldoBase, fechaIngreso, tipoContrato, regimen, categoriaLoep, escalaId,
      pagoDecimoTercero, pagoDecimoCuarto, pagoFondosReserva, recibeHorasExtras,
    },
    avisos,
  };
}

const aApi = (fila: Fila) => ({
  ...filaACamel(fila),
  activo: fila.activo === 1,
  recibeHorasExtras: fila.recibe_horas_extras === null ? null : fila.recibe_horas_extras === 1,
});

export function rutasEmpleados(db: DatabaseSync): Router {
  const router = Router();

  const buscar = (idTexto: string): Fila => {
    const fila = uno(db, "SELECT * FROM empleados WHERE id = ?", Number(idTexto));
    if (!fila) throw new ErrorApi(404, ["El empleado no existe."]);
    return fila;
  };

  /** Traduce el choque con la restricción UNIQUE de la cédula a un 409 legible. */
  const guardar = (accion: () => void) => {
    try {
      accion();
    } catch (error) {
      if (String((error as Error).message).includes("UNIQUE")) {
        throw new ErrorApi(409, ["Ya existe un empleado con esa cédula."]);
      }
      throw error;
    }
  };

  router.get("/", (_req, res) => {
    res.json(consultar(db, "SELECT * FROM empleados ORDER BY activo DESC, nombres").map(aApi));
  });

  router.post("/demo", (_req, res) => {
    let nuevos = 0;
    for (const e of EMPLEADOS_DEMO) {
      const r = ejecutar(
        db,
        `INSERT OR IGNORE INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso,
         tipo_contrato, regimen, categoria_loep, escala_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                 (SELECT id FROM escala_salarial WHERE regimen = ? AND grado = ?))`,
        e.cedula, e.nombres, e.cargo, e.sueldoBase, e.fechaIngreso, e.tipoContrato, e.regimen, e.categoriaLoep,
        "LOSEP", e.escalaGrado,
      );
      nuevos += Number(r.changes);
    }
    res.status(201).json({ agregados: nuevos });
  });

  router.get("/:id", (req, res) => {
    res.json(aApi(buscar(req.params.id)));
  });

  router.post("/", (req, res) => {
    const { datos, avisos } = validar(db, req.body ?? {});
    let id = 0;
    guardar(() => {
      const r = ejecutar(
        db,
        `INSERT INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso, tipo_contrato,
         regimen, categoria_loep, escala_id, pago_decimo_tercero, pago_decimo_cuarto,
         pago_fondos_reserva, recibe_horas_extras) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        datos.cedula, datos.nombres, datos.cargo, datos.sueldoBase, datos.fechaIngreso,
        datos.tipoContrato, datos.regimen, datos.categoriaLoep, datos.escalaId,
        datos.pagoDecimoTercero, datos.pagoDecimoCuarto, datos.pagoFondosReserva,
        datos.recibeHorasExtras === null ? null : Number(datos.recibeHorasExtras),
      );
      id = Number(r.lastInsertRowid);
    });
    res.status(201).json({ ...aApi(buscar(String(id))), avisos });
  });

  router.put("/:id", (req, res) => {
    const actual = buscar(req.params.id);
    const { datos, avisos } = validar(db, req.body ?? {});
    guardar(() => {
      ejecutar(
        db,
        `UPDATE empleados SET cedula = ?, nombres = ?, cargo = ?, sueldo_base = ?,
         fecha_ingreso = ?, tipo_contrato = ?, regimen = ?, categoria_loep = ?, escala_id = ?,
         pago_decimo_tercero = ?, pago_decimo_cuarto = ?, pago_fondos_reserva = ?, recibe_horas_extras = ?
         WHERE id = ?`,
        datos.cedula, datos.nombres, datos.cargo, datos.sueldoBase, datos.fechaIngreso,
        datos.tipoContrato, datos.regimen, datos.categoriaLoep, datos.escalaId,
        datos.pagoDecimoTercero, datos.pagoDecimoCuarto, datos.pagoFondosReserva,
        datos.recibeHorasExtras === null ? null : Number(datos.recibeHorasExtras), actual.id,
      );
    });
    res.json({ ...aApi(buscar(req.params.id)), avisos });
  });

  router.patch("/:id/estado", (req, res) => {
    const actual = buscar(req.params.id);
    ejecutar(db, "UPDATE empleados SET activo = 1 - activo WHERE id = ?", actual.id);
    res.json(aApi(buscar(req.params.id)));
  });

  router.delete("/:id", (req, res) => {
    const actual = buscar(req.params.id);
    ejecutar(db, "DELETE FROM empleados WHERE id = ?", actual.id);
    res.status(204).end();
  });

  return router;
}
