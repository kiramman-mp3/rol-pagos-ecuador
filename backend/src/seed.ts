/**
 * Llena la base con los datos de ejemplo: el orgánico (ya viene en las migraciones), los empleados
 * y los roles de pago de enero a septiembre de 2026.
 *
 *   npm --prefix backend run seed                 base vacía (o la que ya tenga datos: no la toca)
 *   npm --prefix backend run seed -- --reiniciar  guarda una copia de la base actual y empieza de cero
 */
import { copyFileSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { abrirBase, uno } from "./db.ts";
import { ANIO_DEMO, cargarEmpleadosDemo, generarRolesDemo, MESES_DEMO } from "./demo.ts";

const aqui = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));
const ruta = process.env.DATABASE ?? aqui("../data/rol_pagos.db");
const reiniciar = process.argv.includes("--reiniciar");

if (reiniciar && existsSync(ruta)) {
  const sello = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "");
  const respaldo = `${ruta}.respaldo-${sello}`;
  copyFileSync(ruta, respaldo);
  rmSync(ruta);
  console.log(`Copia de la base anterior: ${respaldo}`);
}

const db = abrirBase(ruta);
const hay = (tabla: string) => Number(uno(db, `SELECT COUNT(*) AS n FROM ${tabla}`)?.n ?? 0) > 0;
if (hay("empleados") || hay("roles_cabecera")) {
  console.error("La base ya tiene empleados o roles. Usa --reiniciar para empezar de cero (se guarda una copia).");
  db.close();
  process.exit(1);
}

const empleados = cargarEmpleadosDemo(db);
const roles = generarRolesDemo(db);
console.log(
  `Listo: ${empleados} empleados y ${roles} roles de pago (${MESES_DEMO[0]} a ${MESES_DEMO.at(-1)} de ${ANIO_DEMO}) en ${ruta}`,
);
db.close();
