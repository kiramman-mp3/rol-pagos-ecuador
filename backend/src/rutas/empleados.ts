import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";

import { CONTRATOS, EMPLEADOS_DEMO } from "../config.ts";
import { consultar, ejecutar, filaACamel, uno } from "../db.ts";
import type { Fila } from "../db.ts";
import { aDecimal, cedulaValida, ErrorApi, fechaIsoValida } from "../validaciones.ts";

const SBU = 482;

interface DatosEmpleado {
  cedula: string;
  nombres: string;
  cargo: string;
  sueldoBase: number;
  fechaIngreso: string;
  tipoContrato: string;
}

/** Reglas de negocio del formulario. Devuelve los datos limpios y los avisos no bloqueantes. */
function validar(cuerpo: Record<string, unknown>): { datos: DatosEmpleado; avisos: string[] } {
  const texto = (campo: string) => String(cuerpo[campo] ?? "").trim();
  const errores: string[] = [];
  const avisos: string[] = [];

  const cedula = texto("cedula");
  const nombres = texto("nombres");
  const cargo = texto("cargo");
  const tipoContrato = texto("tipoContrato");
  const fechaIngreso = texto("fechaIngreso");

  if (!cedulaValida(cedula)) errores.push("La cédula no es válida (10 dígitos, módulo 10).");
  if (!nombres || !cargo) errores.push("Nombres y cargo son obligatorios.");
  if (!CONTRATOS.includes(tipoContrato)) errores.push("Tipo de contrato inválido.");
  if (!fechaIsoValida(fechaIngreso)) errores.push("Fecha de ingreso inválida.");

  let sueldoBase = 0;
  try {
    sueldoBase = aDecimal(cuerpo.sueldoBase).toNumber();
    if (sueldoBase <= 0) errores.push("El sueldo base debe ser mayor a cero.");
    else if (sueldoBase < SBU) avisos.push("Aviso: el sueldo es menor al SBU 2026 ($482).");
  } catch (error) {
    errores.push(`Sueldo base: ${(error as Error).message}.`);
  }

  if (errores.length) throw new ErrorApi(400, errores);
  return { datos: { cedula, nombres, cargo, sueldoBase, fechaIngreso, tipoContrato }, avisos };
}

const aApi = (fila: Fila) => ({ ...filaACamel(fila), activo: fila.activo === 1 });

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
         tipo_contrato) VALUES (?, ?, ?, ?, ?, ?)`,
        ...e,
      );
      nuevos += Number(r.changes);
    }
    res.status(201).json({ agregados: nuevos });
  });

  router.get("/:id", (req, res) => {
    res.json(aApi(buscar(req.params.id)));
  });

  router.post("/", (req, res) => {
    const { datos, avisos } = validar(req.body ?? {});
    let id = 0;
    guardar(() => {
      const r = ejecutar(
        db,
        `INSERT INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso, tipo_contrato)
         VALUES (?, ?, ?, ?, ?, ?)`,
        datos.cedula, datos.nombres, datos.cargo, datos.sueldoBase, datos.fechaIngreso,
        datos.tipoContrato,
      );
      id = Number(r.lastInsertRowid);
    });
    res.status(201).json({ ...aApi(buscar(String(id))), avisos });
  });

  router.put("/:id", (req, res) => {
    const actual = buscar(req.params.id);
    const { datos, avisos } = validar(req.body ?? {});
    guardar(() => {
      ejecutar(
        db,
        `UPDATE empleados SET cedula = ?, nombres = ?, cargo = ?, sueldo_base = ?,
         fecha_ingreso = ?, tipo_contrato = ? WHERE id = ?`,
        datos.cedula, datos.nombres, datos.cargo, datos.sueldoBase, datos.fechaIngreso,
        datos.tipoContrato, actual.id,
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
