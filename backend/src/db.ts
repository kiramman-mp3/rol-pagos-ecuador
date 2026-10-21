/**
 * PostgreSQL: `pg` contra un servidor (Supabase) o PGlite, un Postgres que corre dentro del proceso,
 * para las pruebas (en memoria) y para trabajar en local sin instalar nada (en una carpeta).
 */
import { readdirSync, readFileSync } from "node:fs";

import type { PGlite } from "@electric-sql/pglite";
import pg from "pg";

export type Valor = string | number | null;
export type Fila = Record<string, string | number | null>;

/** Una conexión (o la base entera) donde correr consultas. Dentro de una transacción es la misma conexión. */
export interface Base {
  consultar(sql: string, params: Valor[]): Promise<{ filas: Fila[]; afectadas: number }>;
  /** Varias sentencias seguidas, sin parámetros (migraciones). */
  ejecutarScript(sql: string): Promise<void>;
  transaccion<T>(trabajo: (tx: Base) => Promise<T>): Promise<T>;
  cerrar(): Promise<void>;
}

const CARPETA_MIGRACIONES = new URL("./migraciones/", import.meta.url);

/** Los `?` de las consultas pasan a `$1, $2…`, sin tocar los que estén dentro de un texto entre comillas. */
export const aPlaceholders = (sql: string) => {
  let n = 0;
  return sql.replace(/'[^']*'|\?/g, (trozo) => (trozo === "?" ? `$${++n}` : trozo));
};

// pg devuelve bigint (COUNT, SUM) y numeric como texto: el resto del código espera números.
const PARSERS_PG = { 20: Number, 1700: Number } as const;

function baseDePg(pool: pg.Pool): Base {
  const sobre = (cliente: pg.Pool | pg.PoolClient, transaccionar: Base["transaccion"]): Base => ({
    async consultar(sql, params) {
      const r = await cliente.query({ text: aPlaceholders(sql), values: params, types: tiposPg });
      return { filas: r.rows as Fila[], afectadas: r.rowCount ?? 0 };
    },
    async ejecutarScript(sql) {
      await cliente.query(sql);
    },
    transaccion: transaccionar,
    async cerrar() {
      await pool.end();
    },
  });
  return sobre(pool, async (trabajo) => {
    const conexion = await pool.connect();
    try {
      await conexion.query("BEGIN");
      const resultado = await trabajo(
        sobre(conexion, () => Promise.reject(new Error("Transacción dentro de otra transacción."))),
      );
      await conexion.query("COMMIT");
      return resultado;
    } catch (error) {
      await conexion.query("ROLLBACK");
      throw error;
    } finally {
      conexion.release();
    }
  });
}

const tiposPg = {
  getTypeParser: (oid: number, formato?: "text" | "binary") => {
    const parser = (PARSERS_PG as Record<number, (v: string) => number>)[oid];
    return parser ?? pg.types.getTypeParser(oid, formato as "text");
  },
};

function baseDePglite(db: PGlite): Base {
  const sobre = (cliente: Pick<PGlite, "query" | "exec">, transaccionar: Base["transaccion"]): Base => ({
    async consultar(sql, params) {
      const r = await cliente.query<Fila>(aPlaceholders(sql), params);
      return { filas: r.rows, afectadas: r.affectedRows ?? 0 };
    },
    async ejecutarScript(sql) {
      await cliente.exec(sql);
    },
    transaccion: transaccionar,
    async cerrar() {
      await db.close();
    },
  });
  const raiz: Base = sobre(db, (trabajo) =>
    db.transaction((t) =>
      trabajo(sobre(t, () => Promise.reject(new Error("Transacción dentro de otra transacción.")))),
    ),
  );
  return raiz;
}

/**
 * Abre la base y deja el esquema al día. `destino` es una URL `postgres://…` (Supabase),
 * `:memory:` (pruebas) o una carpeta donde PGlite guarda los datos.
 */
export async function abrirBase(destino: string): Promise<Base> {
  let db: Base;
  if (/^postgres(ql)?:\/\//.test(destino)) {
    db = baseDePg(new pg.Pool({
      connectionString: destino,
      ssl: { rejectUnauthorized: false }, // Supabase exige TLS
      max: 3,
    }));
  } else {
    const { PGlite: Motor } = await import("@electric-sql/pglite");
    db = baseDePglite(new Motor(destino === ":memory:" ? undefined : destino, {
      parsers: PARSERS_PGLITE,
    }));
  }
  await migrar(db);
  return db;
}

const PARSERS_PGLITE = { 20: Number, 1700: Number };

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
 * Aplica las migraciones pendientes. Las aplicadas quedan en `esquema_migraciones`, así que abrir la
 * misma base dos veces no repite nada. Cada una corre en una transacción con un candado: si dos
 * instancias arrancan a la vez, la segunda espera y ve que ya está hecha.
 */
export async function migrar(db: Base) {
  await db.ejecutarScript(
    "CREATE TABLE IF NOT EXISTS esquema_migraciones (version INTEGER PRIMARY KEY, nombre TEXT NOT NULL)",
  );
  for (const m of leerMigraciones()) {
    if (m.version <= (await versionEsquema(db))) continue;
    try {
      await db.transaccion(async (tx) => {
        await tx.consultar("SELECT pg_advisory_xact_lock(727274)", []);
        if (m.version <= (await versionEsquema(tx))) return;
        await tx.ejecutarScript(m.sql);
        await tx.consultar("INSERT INTO esquema_migraciones (version, nombre) VALUES (?, ?)", [m.version, m.nombre]);
      });
    } catch (error) {
      throw new Error(`Falló la migración ${m.nombre}: ${(error as Error).message}`, { cause: error });
    }
  }
}

/** Versión del esquema de una base abierta (la de la última migración aplicada). */
export async function versionEsquema(db: Base): Promise<number> {
  const { filas } = await db.consultar("SELECT COALESCE(MAX(version), 0) AS version FROM esquema_migraciones", []);
  return Number(filas[0].version);
}

export async function consultar(db: Base, sql: string, ...params: Valor[]): Promise<Fila[]> {
  return (await db.consultar(sql, params)).filas;
}

export async function uno(db: Base, sql: string, ...params: Valor[]): Promise<Fila | undefined> {
  return (await db.consultar(sql, params)).filas[0];
}

/** Corre una sentencia y dice cuántas filas tocó. */
export async function ejecutar(db: Base, sql: string, ...params: Valor[]): Promise<{ changes: number }> {
  return { changes: (await db.consultar(sql, params)).afectadas };
}

/** INSERT que devuelve el `id` de la fila nueva. */
export async function insertar(db: Base, sql: string, ...params: Valor[]): Promise<number> {
  const { filas } = await db.consultar(`${sql} RETURNING id`, params);
  return Number(filas[0].id);
}

/** Ejecuta todo o nada: si algo falla, no queda nada a medias. */
export function transaccion<T>(db: Base, trabajo: (tx: Base) => Promise<T>): Promise<T> {
  return db.transaccion(trabajo);
}

/** ¿El error es un choque con una restricción UNIQUE? (23505 en Postgres) */
export const esDuplicado = (error: unknown) => (error as { code?: string }).code === "23505";

/** sueldo_base -> sueldoBase, horas_suplementarias -> horasSuplementarias */
export const aCamel = (clave: string) => clave.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());

/** sueldoBase -> sueldo_base, horasSuplementarias -> horas_suplementarias */
export const aSnake = (clave: string) =>
  clave.replace(/([A-Z])/g, (c) => `_${c.toLowerCase()}`).replace(/([a-z])([0-9])/g, "$1_$2");

export function filaACamel(fila: Fila): Record<string, string | number | null> {
  return Object.fromEntries(Object.entries(fila).map(([k, v]) => [aCamel(k), v]));
}
