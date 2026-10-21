/** Orgánico funcional: puestos con su función, responsabilidad, sector y referencia salarial. */
import { consultar, ejecutar, esDuplicado, filaACamel, insertar, uno } from "./db.ts";
import type { Base, Fila } from "./db.ts";
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
  /** quién encabeza el puesto, si se le asignó un responsable */
  responsable: Persona | null;
  /** los empleados activos que ocupan el puesto: de ellos sale el responsable */
  ocupantes: Persona[];
}

export interface Persona {
  id: number;
  nombres: string;
}

const aPuesto = async (db: Base, f: Fila): Promise<Puesto> => {
  const { responsableId, ...base } = filaACamel(f) as unknown as Puesto & { responsableId: number | null };
  const ocupantes = (await consultar(
    db, "SELECT id, nombres FROM empleados WHERE puesto_id = ? AND activo = 1 ORDER BY nombres", f.id,
  )).map((o) => ({ id: Number(o.id), nombres: String(o.nombres) }));
  return {
    ...base,
    referencia: base.escalaId === null ? null : ((await buscarGrado(db, base.escalaId)) ?? null),
    empleados: Number((await uno(db, "SELECT COUNT(*) AS n FROM empleados WHERE puesto_id = ?", f.id))?.n ?? 0),
    responsable: ocupantes.find((o) => o.id === responsableId) ?? null,
    ocupantes,
  };
};

export async function listarPuestos(db: Base): Promise<Puesto[]> {
  return Promise.all((await consultar(db, "SELECT * FROM puestos ORDER BY id")).map((f) => aPuesto(db, f)));
}

export async function buscarPuesto(db: Base, id: number): Promise<Puesto | undefined> {
  const fila = await uno(db, "SELECT * FROM puestos WHERE id = ?", id);
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
async function cuelgaDe(db: Base, candidato: number, id: number): Promise<boolean> {
  const vistos = new Set<number>();
  let actual: number | null = candidato;
  while (actual !== null && !vistos.has(actual)) {
    if (actual === id) return true;
    vistos.add(actual);
    actual = ((await uno(db, "SELECT superior_id FROM puestos WHERE id = ?", actual))?.superior_id as number | null) ?? null;
  }
  return false;
}

/** Valida el cuerpo de un puesto; reporta todos los problemas juntos. */
async function validarPuesto(db: Base, cuerpo: Record<string, unknown>, id?: number): Promise<DatosPuesto> {
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
    if (!(await buscarPuesto(db, superiorId))) errores.push("El puesto superior no existe.");
    else if (id !== undefined && (await cuelgaDe(db, superiorId, id))) {
      errores.push("Un puesto no puede depender de sí mismo ni de uno que depende de él.");
    }
  }

  let escalaId: number | null = null;
  if (vacio(cuerpo.escalaId)) {
    errores.push("Elige el nivel de la escala salarial que sirve de referencia.");
  } else {
    escalaId = Number(cuerpo.escalaId);
    if (!(await buscarGrado(db, escalaId))) errores.push("El nivel de la escala salarial no existe.");
  }

  if (errores.length) throw new ErrorApi(400, errores);
  return {
    nombre: nombre.slice(0, 100), superiorId, funcion: funcion.slice(0, 400),
    responsabilidad: responsabilidad.slice(0, 400), sector: sector.slice(0, 120), escalaId,
  };
}

/** Traduce el choque con UNIQUE(nombre) a un 409 legible. */
async function conDuplicados<T>(accion: () => Promise<T>): Promise<T> {
  try {
    return await accion();
  } catch (error) {
    if (esDuplicado(error)) {
      throw new ErrorApi(409, ["Ya existe un puesto con ese nombre."]);
    }
    throw error;
  }
}

export async function crearPuesto(db: Base, cuerpo: Record<string, unknown>): Promise<Puesto> {
  const d = await validarPuesto(db, cuerpo);
  const id = await conDuplicados(() =>
    insertar(
      db,
      "INSERT INTO puestos (nombre, superior_id, funcion, responsabilidad, sector, escala_id) VALUES (?, ?, ?, ?, ?, ?)",
      d.nombre, d.superiorId, d.funcion, d.responsabilidad, d.sector, d.escalaId,
    ),
  );
  return (await buscarPuesto(db, id))!;
}

export async function actualizarPuesto(db: Base, id: number, cuerpo: Record<string, unknown>): Promise<Puesto> {
  if (!(await buscarPuesto(db, id))) throw new ErrorApi(404, ["El puesto no existe."]);
  const d = await validarPuesto(db, cuerpo, id);
  await conDuplicados(() =>
    ejecutar(
      db,
      "UPDATE puestos SET nombre = ?, superior_id = ?, funcion = ?, responsabilidad = ?, sector = ?, escala_id = ? WHERE id = ?",
      d.nombre, d.superiorId, d.funcion, d.responsabilidad, d.sector, d.escalaId, id,
    ),
  );
  return (await buscarPuesto(db, id))!;
}

export async function eliminarPuesto(db: Base, id: number) {
  if (!(await buscarPuesto(db, id))) throw new ErrorApi(404, ["El puesto no existe."]);
  await ejecutar(db, "DELETE FROM puestos WHERE id = ?", id);
}

/** Pone o quita (`null`) al responsable de un puesto. Solo puede serlo un empleado activo que lo ocupa. */
export async function asignarResponsable(db: Base, id: number, empleadoId: unknown): Promise<Puesto> {
  if (!(await buscarPuesto(db, id))) throw new ErrorApi(404, ["El puesto no existe."]);
  if (empleadoId === null || empleadoId === undefined || empleadoId === "") {
    await ejecutar(db, "UPDATE puestos SET responsable_id = NULL WHERE id = ?", id);
  } else {
    const empleado = await uno(db, "SELECT id, nombres, activo, puesto_id FROM empleados WHERE id = ?", Number(empleadoId));
    if (!empleado) throw new ErrorApi(400, ["El empleado no existe."]);
    if (empleado.puesto_id !== id || empleado.activo !== 1) {
      throw new ErrorApi(400, [`${empleado.nombres} no puede ser responsable: debe ser un empleado activo que ocupe este puesto.`]);
    }
    await ejecutar(db, "UPDATE puestos SET responsable_id = ? WHERE id = ?", empleado.id, id);
  }
  return (await buscarPuesto(db, id))!;
}

/** Quita a un empleado como responsable de cualquier puesto que ya no ocupa (o de todos si queda inactivo). */
export async function soltarResponsable(db: Base, empleadoId: number, puestoQueOcupa: number | null) {
  await ejecutar(db, "UPDATE puestos SET responsable_id = NULL WHERE responsable_id = ? AND id IS DISTINCT FROM ?", empleadoId, puestoQueOcupa);
}
