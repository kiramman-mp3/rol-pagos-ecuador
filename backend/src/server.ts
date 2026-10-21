import { fileURLToPath } from "node:url";

import { crearApp } from "./app.ts";
import { abrirBase } from "./db.ts";

const aqui = (ruta: string) => fileURLToPath(new URL(ruta, import.meta.url));

const puerto = Number(process.env.PORT ?? 3000);
// DATABASE_URL: postgres://… (Supabase). Sin ella, una base PGlite en backend/data para trabajar en local.
const db = await abrirBase(process.env.DATABASE_URL ?? process.env.DATABASE ?? aqui("../data/pglite"));
const app = crearApp(db, {
  carpetaFrontend: process.env.FRONTEND_DIR ?? aqui("../../frontend/dist/frontend/browser"),
});

app.listen(puerto, () => {
  console.log(`Rol de pagos: http://localhost:${puerto}`);
});
