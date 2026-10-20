/** SQLite con el módulo integrado de Node (sin dependencias nativas ni ORM). */
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Fila = Record<string, string | number | null>;
export type Valor = string | number | null;

const CARPETA_MIGRACIONES = new URL("./migraciones/", import.meta.url);

interface Migracion {
  version: number;
  nombre: string;
  sql: string;
}

/** Archivos NNN_nombre.sql, en orden. El número es la versión del esquema. */
function leerMigraciones(): Migracion[] {
  return readdirSync(CARPETA_MIGRACIONES)
    .filter((archivo) => /^\d{3}_.+\.sql$/.test(archivo))
    .sort()
    .map((archivo) => ({
      version: Number(archivo.slice(0, 3)),
      nombre: archivo,
      sql: readFileSync(new URL(archivo, CARPETA_MIGRACIONES), "utf8"),
    }));
}

/**
 * Aplica las migraciones pendientes. La versión aplicada queda en `PRAGMA user_version`,
 * así que abrir la misma base dos veces no repite nada, y una base creada antes de
 * existir las migraciones (versión 0) se pone al día sin perder datos.
 */
function migrar(db: DatabaseSync) {
  const actual = versionEsquema(db);
  for (const m of leerMigraciones().filter((x) => x.version > actual)) {
    db.exec("BEGIN");
    try {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw new Error(`Falló la migración ${m.nombre}: ${(error as Error).message}`, { cause: error });
    }
  }
}

export function abrirBase(ruta: string): DatabaseSync {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec("PRAGMA foreign_keys = ON");
  migrar(db);
  return db;
}

/** Versión del esquema de una base abierta (la de la última migración aplicada). */
export function versionEsquema(db: DatabaseSync): number {
  return Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
}

export function consultar(db: DatabaseSync, sql: string, ...params: Valor[]): Fila[] {
  return db.prepare(sql).all(...params) as unknown as Fila[];
}

export function uno(db: DatabaseSync, sql: string, ...params: Valor[]): Fila | undefined {
  return db.prepare(sql).get(...params) as unknown as Fila | undefined;
}

export function ejecutar(db: DatabaseSync, sql: string, ...params: Valor[]) {
  return db.prepare(sql).run(...params);
}

/** Ejecuta todo o nada: si algo falla, no queda nada a medias. */
export function transaccion<T>(db: DatabaseSync, trabajo: () => T): T {
  db.exec("BEGIN");
  try {
    const resultado = trabajo();
    db.exec("COMMIT");
    return resultado;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

/** sueldo_base -> sueldoBase, horas_suplementarias -> horasSuplementarias */
export const aCamel = (clave: string) => clave.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** sueldoBase -> sueldo_base, horasSuplementarias -> horas_suplementarias */
export const aSnake = (clave: string) =>
  clave.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`).replace(/([a-z])([0-9])/g, "$1_$2");

export function filaACamel(fila: Fila): Record<string, string | number | null> {
  return Object.fromEntries(Object.entries(fila).map(([k, v]) => [aCamel(k), v]));
}
