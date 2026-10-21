/** Entrada para Vercel: la API de Express contra la base de Supabase (DATABASE_URL). */
import { crearApp } from "./app.ts";
import { abrirBase } from "./db.ts";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Falta la variable de entorno DATABASE_URL (la cadena de conexión de Supabase).");

export default crearApp(await abrirBase(url));
