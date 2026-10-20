/** Escala salarial: grados con su remuneración mensual unificada. */
import type { DatabaseSync } from "node:sqlite";

import { consultar, ejecutar, filaACamel, uno } from "./db.ts";
import type { Fila } from "./db.ts";
import { buscarRegimen } from "./regimenes.ts";
import { aDecimal, ErrorApi } from "./validaciones.ts";

export interface Grado {
  id: number;
  regimen: string;
  grado: number;
  denominacion: string;
  rmu: number;
  fuente: string;
}

const aGrado = (f: Fila): Grado => filaACamel(f) as unknown as Grado;

export function listarEscala(db: DatabaseSync, regimen?: string): Grado[] {
  const filas = regimen
    ? consultar(db, "SELECT * FROM escala_salarial WHERE regimen = ? ORDER BY grado", regimen)
    : consultar(db, "SELECT * FROM escala_salarial ORDER BY regimen, grado");
  return filas.map(aGrado);
}

export function buscarGrado(db: DatabaseSync, id: number): Grado | undefined {
  const fila = uno(db, "SELECT * FROM escala_salarial WHERE id = ?", id);
  return fila ? aGrado(fila) : undefined;
}

interface DatosGrado {
  regimen: string;
  grado: number;
  denominacion: string;
  rmu: number;
  fuente: string;
}

/** Valida el cuerpo de un grado; reporta todos los problemas juntos. */
function validarGrado(db: DatabaseSync, cuerpo: Record<string, unknown>): DatosGrado {
  const errores: string[] = [];
  const regimen = String(cuerpo.regimen ?? "").trim();
  const denominacion = String(cuerpo.denominacion ?? "").trim();
  const grado = Number(cuerpo.grado);

  if (buscarRegimen(db, regimen)?.tipo !== "reglas") {
    errores.push("El régimen debe existir y tener reglas propias (por ejemplo LOSEP o Código del Trabajo).");
  }
  if (!Number.isInteger(grado) || grado < 1 || grado > 99) errores.push("El grado debe ser un entero entre 1 y 99.");
  if (!denominacion) errores.push("La denominación del puesto es obligatoria.");

  let rmu = 0;
  try {
    rmu = aDecimal(cuerpo.rmu).toNumber();
    if (rmu <= 0) errores.push("La remuneración debe ser mayor a cero.");
  } catch (error) {
    errores.push(`Remuneración: ${(error as Error).message}.`);
  }
  if (errores.length) throw new ErrorApi(400, errores);
  return { regimen, grado, denominacion: denominacion.slice(0, 120), rmu, fuente: String(cuerpo.fuente ?? "").trim().slice(0, 200) };
}

/** Traduce el choque con UNIQUE(régimen, grado) a un 409 legible. */
function conDuplicados<T>(accion: () => T): T {
  try {
    return accion();
  } catch (error) {
    if (String((error as Error).message).includes("UNIQUE")) {
      throw new ErrorApi(409, ["Ya existe ese grado en el régimen."]);
    }
    throw error;
  }
}

export function crearGrado(db: DatabaseSync, cuerpo: Record<string, unknown>): Grado {
  const d = validarGrado(db, cuerpo);
  const id = conDuplicados(() =>
    Number(
      ejecutar(
        db,
        "INSERT INTO escala_salarial (regimen, grado, denominacion, rmu, fuente) VALUES (?, ?, ?, ?, ?)",
        d.regimen, d.grado, d.denominacion, d.rmu, d.fuente,
      ).lastInsertRowid,
    ),
  );
  return buscarGrado(db, id)!;
}

export function actualizarGrado(db: DatabaseSync, id: number, cuerpo: Record<string, unknown>): Grado {
  if (!buscarGrado(db, id)) throw new ErrorApi(404, ["El grado no existe."]);
  const d = validarGrado(db, cuerpo);
  conDuplicados(() =>
    ejecutar(
      db,
      "UPDATE escala_salarial SET regimen = ?, grado = ?, denominacion = ?, rmu = ?, fuente = ? WHERE id = ?",
      d.regimen, d.grado, d.denominacion, d.rmu, d.fuente, id,
    ),
  );
  return buscarGrado(db, id)!;
}

export function eliminarGrado(db: DatabaseSync, id: number) {
  if (!buscarGrado(db, id)) throw new ErrorApi(404, ["El grado no existe."]);
  ejecutar(db, "DELETE FROM escala_salarial WHERE id = ?", id);
}
