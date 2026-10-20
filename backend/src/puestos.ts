/** Orgánico funcional: puestos con su función, responsabilidad, sector y referencia salarial. */
import type { DatabaseSync } from "node:sqlite";

import { consultar, ejecutar, filaACamel, uno } from "./db.ts";
import type { Fila } from "./db.ts";
import { buscarGrado } from "./escala.ts";
import type { Grado } from "./escala.ts";
import { ErrorApi } from "./validaciones.ts";

export interface Puesto {
  id: number;
  nombre: string;
  superiorId: number | null;
  funcion: string;
  responsabilidad: string;
  sector: string;
  escalaId: number | null;
  /** nivel de la escala salarial que sirve de referencia, con su régimen */
  referencia: Grado | null;
  /** cuántos empleados ocupan el puesto */
  empleados: number;
}

const aPuesto = (db: DatabaseSync, f: Fila): Puesto => {
  const base = filaACamel(f) as unknown as Puesto;
  return {
    ...base,
    referencia: base.escalaId === null ? null : (buscarGrado(db, base.escalaId) ?? null),
    empleados: Number(uno(db, "SELECT COUNT(*) AS n FROM empleados WHERE puesto_id = ?", f.id)?.n ?? 0),
  };
};

export function listarPuestos(db: DatabaseSync): Puesto[] {
  return consultar(db, "SELECT * FROM puestos ORDER BY id").map((f) => aPuesto(db, f));
}

export function buscarPuesto(db: DatabaseSync, id: number): Puesto | undefined {
  const fila = uno(db, "SELECT * FROM puestos WHERE id = ?", id);
  return fila ? aPuesto(db, fila) : undefined;
}

interface DatosPuesto {
  nombre: string;
  superiorId: number | null;
  funcion: string;
  responsabilidad: string;
  sector: string;
  escalaId: number | null;
}

/** ¿`candidato` es `id` o está por debajo de él en el orgánico? Impide ciclos al elegir superior. */
function cuelgaDe(db: DatabaseSync, candidato: number, id: number): boolean {
  const vistos = new Set<number>();
  let actual: number | null = candidato;
  while (actual !== null && !vistos.has(actual)) {
    if (actual === id) return true;
    vistos.add(actual);
    actual = (uno(db, "SELECT superior_id FROM puestos WHERE id = ?", actual)?.superior_id as number | null) ?? null;
  }
  return false;
}

/** Valida el cuerpo de un puesto; reporta todos los problemas juntos. */
function validarPuesto(db: DatabaseSync, cuerpo: Record<string, unknown>, id?: number): DatosPuesto {
  const errores: string[] = [];
  const texto = (campo: string) => String(cuerpo[campo] ?? "").trim();
  const nombre = texto("nombre");
  const funcion = texto("funcion");
  const responsabilidad = texto("responsabilidad");
  const sector = texto("sector");
  if (!nombre) errores.push("El nombre del puesto es obligatorio.");
  if (!funcion) errores.push("La función del puesto es obligatoria.");
  if (!responsabilidad) errores.push("La responsabilidad del puesto es obligatoria.");
  if (!sector) errores.push("El sector económico es obligatorio.");

  const vacio = (v: unknown) => v === null || v === undefined || v === "";
  let superiorId: number | null = null;
  if (!vacio(cuerpo.superiorId)) {
    superiorId = Number(cuerpo.superiorId);
    if (!buscarPuesto(db, superiorId)) errores.push("El puesto superior no existe.");
    else if (id !== undefined && cuelgaDe(db, superiorId, id)) {
      errores.push("Un puesto no puede depender de sí mismo ni de uno que depende de él.");
    }
  }

  let escalaId: number | null = null;
  if (vacio(cuerpo.escalaId)) {
    errores.push("Elige el nivel de la escala salarial que sirve de referencia.");
  } else {
    escalaId = Number(cuerpo.escalaId);
    if (!buscarGrado(db, escalaId)) errores.push("El nivel de la escala salarial no existe.");
  }

  if (errores.length) throw new ErrorApi(400, errores);
  return {
    nombre: nombre.slice(0, 100), superiorId, funcion: funcion.slice(0, 400),
    responsabilidad: responsabilidad.slice(0, 400), sector: sector.slice(0, 120), escalaId,
  };
}

/** Traduce el choque con UNIQUE(nombre) a un 409 legible. */
function conDuplicados<T>(accion: () => T): T {
  try {
    return accion();
  } catch (error) {
    if (String((error as Error).message).includes("UNIQUE")) {
      throw new ErrorApi(409, ["Ya existe un puesto con ese nombre."]);
    }
    throw error;
  }
}

export function crearPuesto(db: DatabaseSync, cuerpo: Record<string, unknown>): Puesto {
  const d = validarPuesto(db, cuerpo);
  const id = conDuplicados(() =>
    Number(
      ejecutar(
        db,
        "INSERT INTO puestos (nombre, superior_id, funcion, responsabilidad, sector, escala_id) VALUES (?, ?, ?, ?, ?, ?)",
        d.nombre, d.superiorId, d.funcion, d.responsabilidad, d.sector, d.escalaId,
      ).lastInsertRowid,
    ),
  );
  return buscarPuesto(db, id)!;
}

export function actualizarPuesto(db: DatabaseSync, id: number, cuerpo: Record<string, unknown>): Puesto {
  if (!buscarPuesto(db, id)) throw new ErrorApi(404, ["El puesto no existe."]);
  const d = validarPuesto(db, cuerpo, id);
  conDuplicados(() =>
    ejecutar(
      db,
      "UPDATE puestos SET nombre = ?, superior_id = ?, funcion = ?, responsabilidad = ?, sector = ?, escala_id = ? WHERE id = ?",
      d.nombre, d.superiorId, d.funcion, d.responsabilidad, d.sector, d.escalaId, id,
    ),
  );
  return buscarPuesto(db, id)!;
}

export function eliminarPuesto(db: DatabaseSync, id: number) {
  if (!buscarPuesto(db, id)) throw new ErrorApi(404, ["El puesto no existe."]);
  ejecutar(db, "DELETE FROM puestos WHERE id = ?", id);
}
