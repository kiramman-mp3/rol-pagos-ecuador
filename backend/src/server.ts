import { fileURLToPath } from "node:url";

import { crearApp } from "./app.ts";

const aqui = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));

const puerto = Number(process.env.PORT ?? 3000);
const { app } = crearApp({
  rutaBase: process.env.DATABASE ?? aqui("../data/rol_pagos.db"),
  carpetaFrontend: process.env.FRONTEND_DIR ?? aqui("../../frontend/dist/frontend/browser"),
});

app.listen(puerto, () => {
  console.log(`Rol de pagos: http://localhost:${puerto}`);
});
