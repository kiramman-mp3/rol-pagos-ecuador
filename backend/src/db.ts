/** SQLite con el módulo integrado de Node (sin dependencias nativas ni ORM). */
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

export type Fila = Record<string, string | number | null>;
export type Valor = string | number | null;

const ESQUEMA = readFileSync(new URL("./schema.sql", import.meta.url), "utf8");

export function abrirBase(ruta: string): DatabaseSync {
  if (ruta !== ":memory:") mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(ESQUEMA);
  return db;
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

/** sueldo_base -> sueldoBase, horas_50 -> horas50 */
export const aCamel = (clave: string) => clave.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** sueldoBase -> sueldo_base, horas50 -> horas_50 */
export const aSnake = (clave: string) =>
  clave.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`).replace(/([a-z])([0-9])/g, "$1_$2");

export function filaACamel(fila: Fila): Record<string, string | number | null> {
  return Object.fromEntries(Object.entries(fila).map(([k, v]) => [aCamel(k), v]));
}
