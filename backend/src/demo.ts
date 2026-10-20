/** Datos de ejemplo: empleados del orgánico funcional y, para el seed, sus roles de pago. */
import { Decimal } from "decimal.js";
import type { DatabaseSync } from "node:sqlite";

import { EMPLEADOS_DEMO } from "./config.ts";
import { ejecutar } from "./db.ts";
import { empleadosDelPeriodo, guardarRol } from "./rutas/roles.ts";
import type { Novedad } from "./rutas/roles.ts";

/** Inserta los empleados de ejemplo que falten (por cédula) con su puesto y su grado. Devuelve cuántos agregó. */
export function cargarEmpleadosDemo(db: DatabaseSync): number {
  let nuevos = 0;
  for (const e of EMPLEADOS_DEMO) {
    const r = ejecutar(
      db,
      `INSERT OR IGNORE INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso,
       tipo_contrato, regimen, categoria_loep, escala_id, puesto_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?,
               (SELECT id FROM escala_salarial WHERE regimen = ? AND grado = ?),
               (SELECT id FROM puestos WHERE nombre = ?))`,
      e.cedula, e.nombres, e.cargo, e.sueldoBase, e.fechaIngreso, e.tipoContrato, e.regimen, e.categoriaLoep,
      e.escalaRegimen, e.escalaGrado, e.puesto,
    );
    nuevos += Number(r.changes);
  }
  return nuevos;
}

/** Año y meses de los roles de ejemplo: todo el año 2026 hasta septiembre (octubre queda para generarlo a mano). */
export const ANIO_DEMO = 2026;
export const MESES_DEMO = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Número fijo derivado de empleado y mes: las novedades de ejemplo son siempre las mismas. */
const variacion = (empleadoId: number, mes: number) => (empleadoId * 7 + mes * 13) % 17;

/** Horas suplementarias y extraordinarias de un mes según el puesto; null si el puesto no tiene novedades. */
function horasDelPuesto(puesto: string, v: number): [number, number] | null {
  if (puesto === "Operaciones de instalaciones") return [4 + (v % 9), v % 4 === 0 ? 4 : 0];
  if (puesto === "Supervisor de instalaciones") return [2 + (v % 5), 0];
  if (puesto === "Auxiliar de guardalmacén") return [v % 7, 0];
  return null;
}

/**
 * Novedades de ejemplo de un mes: el personal de campo hace algunas horas extras y de vez en cuando
 * tiene un anticipo descontado. Gerencia, administración y el personal público no tienen novedades.
 */
function novedadesDemo(db: DatabaseSync, anio: number, mes: number): Map<number, Novedad> {
  const cero = new Decimal(0);
  const novedades = new Map<number, Novedad>();
  for (const e of empleadosDelPeriodo(db, anio, mes)) {
    const id = Number(e.id);
    const v = variacion(id, mes);
    if (e.regimen !== "CODIGO_TRABAJO") continue;
    const horas = horasDelPuesto(String(e.cargo), v);
    if (!horas) continue;
    const [suplementarias, extraordinarias] = horas;
    novedades.set(id, {
      horasSuplementarias: new Decimal(suplementarias),
      horasExtraordinarias: new Decimal(extraordinarias),
      horasDescanso: cero,
      horasNocturnas: cero,
      comisiones: cero,
      otrosDescuentos: new Decimal(mes % 3 === 0 && v % 2 === 0 ? 25 : 0),
    });
  }
  return novedades;
}

/** Genera los roles de ejemplo de enero a septiembre. Devuelve cuántos generó. */
export function generarRolesDemo(db: DatabaseSync): number {
  let generados = 0;
  for (const mes of MESES_DEMO) {
    const empleados = empleadosDelPeriodo(db, ANIO_DEMO, mes);
    if (!empleados.length) continue;
    guardarRol(db, ANIO_DEMO, mes, empleados, novedadesDemo(db, ANIO_DEMO, mes));
    generados += 1;
  }
  return generados;
}
