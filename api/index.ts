/** Función de Vercel: la misma API de Express, con una base SQLite de ejemplo en /tmp. */
import { cargarEmpleadosDemo, generarRolesDemo } from "../backend/src/demo.ts";
import { crearApp } from "../backend/src/app.ts";
import { uno } from "../backend/src/db.ts";

// /tmp es lo único escribible en Vercel y no persiste entre instancias: cada arranque en frío parte de los datos de ejemplo.
const { app, db } = crearApp({ rutaBase: "/tmp/rol_pagos.db" });
if (Number(uno(db, "SELECT COUNT(*) AS n FROM empleados")?.n ?? 0) === 0) {
  cargarEmpleadosDemo(db);
  generarRolesDemo(db);
}

export default app;
