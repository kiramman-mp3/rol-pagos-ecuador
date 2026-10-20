/** Arma las reglas del motor (`ReglasRol`) a partir de lo guardado en la base. */
import { REGLAS_CT_2026 } from "./calculos.ts";
import type { ReglasRol } from "./calculos.ts";
import type { ParametrosAnio } from "./parametros.ts";

/** Reglas de un año: el SBU y la tabla del IR salen de la base; el resto, del régimen. */
export function reglasDe(parametros: ParametrosAnio): ReglasRol {
  return { ...REGLAS_CT_2026, sbu: parametros.sbu, tablaIr: parametros.tablaIr };
}
