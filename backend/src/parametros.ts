/** Parámetros anuales (SBU y tabla del IR) guardados en la base. */
import type { DatabaseSync } from "node:sqlite";

import type { TramoIR } from "./calculos.ts";
import { consultar, ejecutar, uno } from "./db.ts";
import type { Fila } from "./db.ts";
import { ErrorApi } from "./validaciones.ts";

export interface ParametrosAnio {
  anio: number;
  sbu: number;
  tablaIr: TramoIR[];
  fuente: string;
}

const aParametros = (fila: Fila): ParametrosAnio => ({
  anio: Number(fila.anio),
  sbu: Number(fila.sbu),
  tablaIr: JSON.parse(String(fila.tabla_ir)) as TramoIR[],
  fuente: String(fila.fuente ?? ""),
});

export function aniosConParametros(db: DatabaseSync): number[] {
  return consultar(db, "SELECT anio FROM parametros_anuales ORDER BY anio DESC").map((f) => Number(f.anio));
}

/**
 * Parámetros de un año. Si ese año no tiene, se usa el más reciente anterior y se
 * avisa (`exacto: false`); si no hay ninguno anterior, se usa el más antiguo.
 */
export function parametrosDelAnio(
  db: DatabaseSync, anio: number,
): { parametros: ParametrosAnio; exacto: boolean } {
  const fila =
    uno(db, "SELECT * FROM parametros_anuales WHERE anio = ?", anio) ??
    uno(db, "SELECT * FROM parametros_anuales WHERE anio < ? ORDER BY anio DESC LIMIT 1", anio) ??
    uno(db, "SELECT * FROM parametros_anuales ORDER BY anio LIMIT 1");
  if (!fila) throw new ErrorApi(500, ["No hay parámetros anuales cargados."]);
  const parametros = aParametros(fila);
  return { parametros, exacto: parametros.anio === anio };
}

/** Valida la forma de la tabla: tramos contiguos, crecientes y el último abierto. */
export function validarTablaIr(tabla: unknown): TramoIR[] {
  const errores: string[] = [];
  if (!Array.isArray(tabla) || tabla.length === 0) {
    throw new ErrorApi(400, ["La tabla del impuesto a la renta debe tener al menos un tramo."]);
  }
  const tramos = tabla as Record<string, unknown>[];
  tramos.forEach((t, i) => {
    const n = i + 1;
    const desde = Number(t.desde);
    const cuota = Number(t.cuota);
    const porcentaje = Number(t.porcentaje);
    const ultimo = i === tramos.length - 1;
    if (!Number.isFinite(desde) || desde < 0) errores.push(`Tramo ${n}: 'desde' debe ser un número mayor o igual a 0.`);
    if (!Number.isFinite(cuota) || cuota < 0) errores.push(`Tramo ${n}: la cuota debe ser mayor o igual a 0.`);
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 1) {
      errores.push(`Tramo ${n}: el porcentaje debe estar entre 0 y 1 (0.05 = 5%).`);
    }
    if (i === 0 && desde !== 0) errores.push("El primer tramo debe empezar en 0.");
    if (ultimo) {
      if (t.hasta !== null) errores.push(`Tramo ${n}: el último tramo debe quedar abierto ('hasta' vacío).`);
    } else {
      const hasta = Number(t.hasta);
      if (!Number.isFinite(hasta) || hasta <= desde) errores.push(`Tramo ${n}: 'hasta' debe ser mayor que 'desde'.`);
      if (Number(tramos[i + 1].desde) !== hasta) errores.push(`Tramo ${n}: el siguiente tramo debe empezar donde termina este.`);
    }
  });
  if (errores.length) throw new ErrorApi(400, errores);
  return tramos.map((t) => ({
    desde: Number(t.desde),
    hasta: t.hasta === null ? null : Number(t.hasta),
    cuota: Number(t.cuota),
    porcentaje: Number(t.porcentaje),
  }));
}

export function guardarParametros(
  db: DatabaseSync, anio: number, sbu: number, tablaIr: TramoIR[], fuente: string,
) {
  ejecutar(
    db,
    `INSERT INTO parametros_anuales (anio, sbu, tabla_ir, fuente) VALUES (?, ?, ?, ?)
     ON CONFLICT(anio) DO UPDATE SET sbu = excluded.sbu, tabla_ir = excluded.tabla_ir, fuente = excluded.fuente`,
    anio, sbu, JSON.stringify(tablaIr), fuente,
  );
}
