/** Datos de ejemplo: empleados del orgánico funcional y, para el seed, sus roles de pago. */
import { Decimal } from "decimal.js";
import { EMPLEADOS_DEMO } from "./config.ts";
import { ejecutar } from "./db.ts";
import type { Base } from "./db.ts";
import { empleadosDelPeriodo, guardarRol } from "./rutas/roles.ts";
import type { Novedad } from "./rutas/roles.ts";

/** Inserta los empleados de ejemplo que falten (por cédula) con su puesto y su grado, y deja a cada puesto su responsable. Devuelve cuántos agregó. */
export async function cargarEmpleadosDemo(db: Base): Promise<number> {
  let nuevos = 0;
  for (const e of EMPLEADOS_DEMO) {
    const r = await ejecutar(
      db,
      `INSERT INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso,
       tipo_contrato, regimen, categoria_loep, escala_id, puesto_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?,
               (SELECT id FROM escala_salarial WHERE regimen = ? AND grado = ?),
               (SELECT id FROM puestos WHERE nombre = ?))
       ON CONFLICT (cedula) DO NOTHING`,
      e.cedula, e.nombres, e.cargo, e.sueldoBase, e.fechaIngreso, e.tipoContrato, e.regimen, e.categoriaLoep,
      e.escalaRegimen, e.escalaGrado, e.puesto,
    );
    nuevos += r.changes;
    if (e.puesto && e.responsable) {
      await ejecutar(
        db,
        `UPDATE puestos SET responsable_id = (SELECT id FROM empleados WHERE cedula = ?)
         WHERE nombre = ? AND responsable_id IS NULL`,
        e.cedula, e.puesto,
      );
    }
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
async function novedadesDemo(db: Base, anio: number, mes: number): Promise<Map<number, Novedad>> {
  const cero = new Decimal(0);
  const novedades = new Map<number, Novedad>();
  for (const e of await empleadosDelPeriodo(db, anio, mes)) {
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
export async function generarRolesDemo(db: Base): Promise<number> {
  let generados = 0;
  for (const mes of MESES_DEMO) {
    const empleados = await empleadosDelPeriodo(db, ANIO_DEMO, mes);
    if (!empleados.length) continue;
    await guardarRol(db, ANIO_DEMO, mes, empleados, await novedadesDemo(db, ANIO_DEMO, mes));
    generados += 1;
  }
  return generados;
}
