/**
 * Llena la base con los datos de ejemplo: el orgánico (ya viene en las migraciones), los empleados
 * y los roles de pago de enero a septiembre de 2026.
 *
 *   npm --prefix backend run seed                 base vacía (o la que ya tenga datos: no la toca)
 *   npm --prefix backend run seed -- --reiniciar  borra empleados, roles y novedades y empieza de cero
 *
 * Con DATABASE_URL en el entorno carga la base de Supabase; sin ella, la de PGlite en backend/data.
 */
import { fileURLToPath } from "node:url";

import { abrirBase, ejecutar, uno } from "./db.ts";
import { ANIO_DEMO, cargarEmpleadosDemo, generarRolesDemo, MESES_DEMO } from "./demo.ts";

const aqui = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));
const destino = process.env.DATABASE_URL ?? process.env.DATABASE ?? aqui("../data/pglite");
const reiniciar = process.argv.includes("--reiniciar");

const db = await abrirBase(destino);
if (reiniciar) {
  // Los roles arrastran su detalle; los empleados sueltan puesto y responsable por las claves foráneas.
  await ejecutar(db, "DELETE FROM roles_cabecera");
  await ejecutar(db, "DELETE FROM novedades");
  await ejecutar(db, "UPDATE puestos SET responsable_id = NULL");
  await ejecutar(db, "DELETE FROM empleados");
}

const hay = async (tabla: string) => Number((await uno(db, `SELECT COUNT(*) AS n FROM ${tabla}`))?.n ?? 0) > 0;
if ((await hay("empleados")) || (await hay("roles_cabecera"))) {
  console.error("La base ya tiene empleados o roles. Usa --reiniciar para empezar de cero (borra esos datos).");
  await db.cerrar();
  process.exit(1);
}

const empleados = await cargarEmpleadosDemo(db);
const roles = await generarRolesDemo(db);
console.log(
  `Listo: ${empleados} empleados y ${roles} roles de pago (${MESES_DEMO[0]} a ${MESES_DEMO.at(-1)} de ${ANIO_DEMO}).`,
);
await db.cerrar();
