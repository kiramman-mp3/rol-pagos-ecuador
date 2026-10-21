/** Escala salarial: grados con su remuneración mensual unificada. */
import { consultar, ejecutar, esDuplicado, filaACamel, insertar, uno } from "./db.ts";
import type { Base, Fila } from "./db.ts";
import { buscarRegimen } from "./regimenes.ts";
import { aDecimal, ErrorApi } from "./validaciones.ts";

export interface Grado {
  id: number;
  regimen: string;
  grado: number;
  denominacion: string;
  rmu: number;
  /** tope del rango de mínimos entre ramas (solo referencia); null si el nivel tiene un solo valor */
  rmuMax: number | null;
  /** true: la RMU es un mínimo y el sueldo puede ser mayor; false: el sueldo es exactamente la RMU */
  esMinimo: boolean;
  fuente: string;
}

const aGrado = (f: Fila): Grado => ({ ...(filaACamel(f) as unknown as Grado), esMinimo: f.es_minimo === 1 });

export async function listarEscala(db: Base, regimen?: string): Promise<Grado[]> {
  const filas = regimen
    ? await consultar(db, "SELECT * FROM escala_salarial WHERE regimen = ? ORDER BY grado", regimen)
    : await consultar(db, "SELECT * FROM escala_salarial ORDER BY regimen, grado");
  return filas.map(aGrado);
}

export async function buscarGrado(db: Base, id: number): Promise<Grado | undefined> {
  const fila = await uno(db, "SELECT * FROM escala_salarial WHERE id = ?", id);
  return fila ? aGrado(fila) : undefined;
}

type DatosGrado = Omit<Grado, "id">;

/** Valida el cuerpo de un grado; reporta todos los problemas juntos. */
async function validarGrado(db: Base, cuerpo: Record<string, unknown>): Promise<DatosGrado> {
  const errores: string[] = [];
  const regimen = String(cuerpo.regimen ?? "").trim();
  const denominacion = String(cuerpo.denominacion ?? "").trim();
  const grado = Number(cuerpo.grado);

  if ((await buscarRegimen(db, regimen))?.tipo !== "reglas") {
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
  let rmuMax: number | null = null;
  if (cuerpo.rmuMax !== null && cuerpo.rmuMax !== undefined && cuerpo.rmuMax !== "") {
    try {
      rmuMax = aDecimal(cuerpo.rmuMax).toNumber();
      if (rmuMax < rmu) errores.push("El tope del rango no puede ser menor a la remuneración.");
    } catch (error) {
      errores.push(`Tope del rango: ${(error as Error).message}.`);
    }
  }
  if (errores.length) throw new ErrorApi(400, errores);
  return {
    regimen, grado, denominacion: denominacion.slice(0, 120), rmu, rmuMax, esMinimo: cuerpo.esMinimo === true,
    fuente: String(cuerpo.fuente ?? "").trim().slice(0, 200),
  };
}

/** Traduce el choque con UNIQUE(régimen, grado) a un 409 legible. */
async function conDuplicados<T>(accion: () => Promise<T>): Promise<T> {
  try {
    return await accion();
  } catch (error) {
    if (esDuplicado(error)) {
      throw new ErrorApi(409, ["Ya existe ese grado en el régimen."]);
    }
    throw error;
  }
}

export async function crearGrado(db: Base, cuerpo: Record<string, unknown>): Promise<Grado> {
  const d = await validarGrado(db, cuerpo);
  const id = await conDuplicados(() =>
    insertar(
      db,
      "INSERT INTO escala_salarial (regimen, grado, denominacion, rmu, rmu_max, es_minimo, fuente) VALUES (?, ?, ?, ?, ?, ?, ?)",
      d.regimen, d.grado, d.denominacion, d.rmu, d.rmuMax, d.esMinimo ? 1 : 0, d.fuente,
    ),
  );
  return (await buscarGrado(db, id))!;
}

export async function actualizarGrado(db: Base, id: number, cuerpo: Record<string, unknown>): Promise<Grado> {
  if (!(await buscarGrado(db, id))) throw new ErrorApi(404, ["El grado no existe."]);
  const d = await validarGrado(db, cuerpo);
  await conDuplicados(() =>
    ejecutar(
      db,
      "UPDATE escala_salarial SET regimen = ?, grado = ?, denominacion = ?, rmu = ?, rmu_max = ?, es_minimo = ?, fuente = ? WHERE id = ?",
      d.regimen, d.grado, d.denominacion, d.rmu, d.rmuMax, d.esMinimo ? 1 : 0, d.fuente, id,
    ),
  );
  return (await buscarGrado(db, id))!;
}

export async function eliminarGrado(db: Base, id: number) {
  if (!(await buscarGrado(db, id))) throw new ErrorApi(404, ["El grado no existe."]);
  await ejecutar(db, "DELETE FROM escala_salarial WHERE id = ?", id);
}
