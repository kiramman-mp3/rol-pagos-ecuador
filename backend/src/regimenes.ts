/** Regímenes laborales guardados en la base y las reglas que de ellos salen. */
import { MODALIDADES, REGLAS_CT_2026 } from "./calculos.ts";
import type { Modalidad, OpcionesRol, ReglasRol } from "./calculos.ts";
import { consultar, ejecutar, uno } from "./db.ts";
import type { Base, Fila } from "./db.ts";
import type { ParametrosAnio } from "./parametros.ts";
import { ErrorApi } from "./validaciones.ts";

export const CATEGORIAS_LOEP = ["servidor", "obrero"] as const;
export type CategoriaLoep = (typeof CATEGORIAS_LOEP)[number];

export interface Regimen {
  codigo: string;
  nombre: string;
  descripcion: string;
  baseLegal: string;
  tipo: "reglas" | "mixto";
  regimenServidor: string | null;
  regimenObrero: string | null;
  iessPersonal: number | null;
  iessPatronal: number | null;
  recargoSuplementarias: number | null;
  recargoExtraordinarias: number | null;
  recargoDescanso: number | null;
  recargoNocturno: number | null;
  topeSuplementariasMes: number | null;
  topeExtraordinariasMes: number | null;
  diasVacaciones: number | null;
  fondosReserva: number | null;
  mesesParaFondos: number | null;
  aplicaDecimoTercero: boolean;
  aplicaDecimoCuarto: boolean;
  aplicaFondosReserva: boolean;
  aplicaHorasExtras: boolean;
  verificado: boolean;
  notas: string;
}

const numero = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function aRegimen(f: Fila): Regimen {
  return {
    codigo: String(f.codigo),
    nombre: String(f.nombre),
    descripcion: String(f.descripcion),
    baseLegal: String(f.base_legal),
    tipo: f.tipo === "mixto" ? "mixto" : "reglas",
    regimenServidor: f.regimen_servidor === null ? null : String(f.regimen_servidor),
    regimenObrero: f.regimen_obrero === null ? null : String(f.regimen_obrero),
    iessPersonal: numero(f.iess_personal),
    iessPatronal: numero(f.iess_patronal),
    recargoSuplementarias: numero(f.recargo_suplementarias),
    recargoExtraordinarias: numero(f.recargo_extraordinarias),
    recargoDescanso: numero(f.recargo_descanso),
    recargoNocturno: numero(f.recargo_nocturno),
    topeSuplementariasMes: numero(f.tope_suplementarias_mes),
    topeExtraordinariasMes: numero(f.tope_extraordinarias_mes),
    diasVacaciones: numero(f.dias_vacaciones),
    fondosReserva: numero(f.fondos_reserva),
    mesesParaFondos: numero(f.meses_para_fondos),
    aplicaDecimoTercero: f.aplica_decimo_tercero === 1,
    aplicaDecimoCuarto: f.aplica_decimo_cuarto === 1,
    aplicaFondosReserva: f.aplica_fondos_reserva === 1,
    aplicaHorasExtras: f.aplica_horas_extras === 1,
    verificado: f.verificado === 1,
    notas: String(f.notas),
  };
}

export async function listarRegimenes(db: Base): Promise<Regimen[]> {
  return (await consultar(db, "SELECT * FROM regimenes ORDER BY CASE codigo WHEN 'CODIGO_TRABAJO' THEN 0 ELSE 1 END, nombre")).map(aRegimen);
}

export async function buscarRegimen(db: Base, codigo: string): Promise<Regimen | undefined> {
  const fila = await uno(db, "SELECT * FROM regimenes WHERE codigo = ?", codigo);
  return fila ? aRegimen(fila) : undefined;
}

/**
 * El régimen cuyas reglas se aplican. Para uno mixto (LOEP) lo decide la categoría:
 * el servidor sigue el régimen de servidores y el obrero el de obreros.
 */
export function regimenAplicado(
  regimenes: ReadonlyMap<string, Regimen>, codigo: string, categoria: string | null,
): Regimen {
  const elegido = regimenes.get(codigo);
  if (!elegido) throw new ErrorApi(400, [`El régimen '${codigo}' no existe.`]);
  if (elegido.tipo !== "mixto") return elegido;
  const destino = categoria === "obrero" ? elegido.regimenObrero : categoria === "servidor" ? elegido.regimenServidor : null;
  const aplicado = destino ? regimenes.get(destino) : undefined;
  if (!aplicado || aplicado.tipo === "mixto") {
    throw new ErrorApi(400, [`${elegido.nombre} necesita la categoría 'servidor' u 'obrero' del empleado.`]);
  }
  return aplicado;
}

export const indexarRegimenes = (lista: Regimen[]) => new Map(lista.map((r) => [r.codigo, r]));

/** Reglas del motor: SBU y tabla del IR salen del año; el resto, del régimen. */
export function reglasDe(parametros: ParametrosAnio, regimen: Regimen): ReglasRol {
  if (regimen.tipo !== "reglas") throw new Error(`${regimen.codigo} no tiene reglas propias`);
  const dato = (valor: number | null, nombre: string): number => {
    if (valor === null) throw new Error(`Al régimen ${regimen.codigo} le falta '${nombre}'`);
    return valor;
  };
  return {
    sbu: parametros.sbu,
    tablaIr: parametros.tablaIr,
    horasMes: REGLAS_CT_2026.horasMes,
    iessPersonal: dato(regimen.iessPersonal, "aporte personal"),
    iessPatronal: dato(regimen.iessPatronal, "aporte patronal"),
    fondosReserva: dato(regimen.fondosReserva, "fondos de reserva"),
    mesesParaFondos: dato(regimen.mesesParaFondos, "meses para fondos"),
    diasVacaciones: dato(regimen.diasVacaciones, "días de vacaciones"),
    recargoSuplementarias: dato(regimen.recargoSuplementarias, "recargo suplementarias"),
    recargoExtraordinarias: dato(regimen.recargoExtraordinarias, "recargo extraordinarias"),
    recargoDescanso: dato(regimen.recargoDescanso, "recargo de descanso"),
    recargoNocturno: dato(regimen.recargoNocturno, "recargo nocturno"),
    topeSuplementariasMes: regimen.topeSuplementariasMes,
    topeExtraordinariasMes: regimen.topeExtraordinariasMes,
  };
}

/**
 * Cómo recibe cada beneficio un empleado. Lo que el empleado tiene escrito manda; si lo dejó
 * vacío, vale el régimen: si lo concede se paga cada mes en el rol (lo que manda la ley por
 * defecto) y si no lo concede, no se recibe.
 */
export function opcionesDe(
  aplicado: Regimen,
  empleado: { pago_decimo_tercero?: unknown; pago_decimo_cuarto?: unknown; pago_fondos_reserva?: unknown; recibe_horas_extras?: unknown },
): OpcionesRol {
  const elegida = (valor: unknown, concede: boolean): Modalidad =>
    MODALIDADES.includes(valor as Modalidad) ? (valor as Modalidad) : concede ? "mensual" : "no";
  return {
    decimoTercero: elegida(empleado.pago_decimo_tercero, aplicado.aplicaDecimoTercero),
    decimoCuarto: elegida(empleado.pago_decimo_cuarto, aplicado.aplicaDecimoCuarto),
    fondosReserva: elegida(empleado.pago_fondos_reserva, aplicado.aplicaFondosReserva),
    recibeHorasExtras:
      empleado.recibe_horas_extras === null || empleado.recibe_horas_extras === undefined
        ? aplicado.aplicaHorasExtras
        : empleado.recibe_horas_extras === 1,
  };
}

// --- Edición ----------------------------------------------------------------

type Cuerpo = Record<string, unknown>;

/** Valida y guarda los cambios de un régimen; devuelve el régimen actualizado. */
export async function actualizarRegimen(db: Base, codigo: string, cuerpo: Cuerpo): Promise<Regimen> {
  const actual = await buscarRegimen(db, codigo);
  if (!actual) throw new ErrorApi(404, ["El régimen no existe."]);
  const errores: string[] = [];

  const rango = (campo: string, etiqueta: string, min: number, max: number, entero = false): number | null => {
    const valor = cuerpo[campo];
    const n = Number(valor);
    if (valor === null || valor === undefined || valor === "" || !Number.isFinite(n) || n < min || n > max || (entero && !Number.isInteger(n))) {
      errores.push(`${etiqueta}: debe ser ${entero ? "un entero" : "un número"} entre ${min} y ${max}.`);
      return null;
    }
    return n;
  };
  const tope = (campo: string, etiqueta: string): number | null => {
    const valor = cuerpo[campo];
    if (valor === null || valor === undefined || valor === "") return null;
    const n = Number(valor);
    if (!Number.isFinite(n) || n < 0 || n > 744) {
      errores.push(`${etiqueta}: déjalo vacío (sin tope) o escribe un número entre 0 y 744.`);
      return null;
    }
    return n;
  };
  const bool = (campo: string) => (cuerpo[campo] === true || cuerpo[campo] === 1 ? 1 : 0);
  const texto = (campo: string, max: number) => String(cuerpo[campo] ?? "").trim().slice(0, max);

  const nombre = texto("nombre", 120);
  if (!nombre) errores.push("El nombre es obligatorio.");
  const verificado = bool("verificado");
  const notas = texto("notas", 1000);

  if (actual.tipo === "mixto") {
    const destinos = new Map((await listarRegimenes(db)).map((r) => [r.codigo, r]));
    const valido = (campo: string, etiqueta: string) => {
      const d = String(cuerpo[campo] ?? "");
      if (destinos.get(d)?.tipo !== "reglas") errores.push(`${etiqueta}: elige un régimen con reglas propias.`);
      return d;
    };
    const servidor = valido("regimenServidor", "Régimen de los servidores");
    const obrero = valido("regimenObrero", "Régimen de los obreros");
    if (errores.length) throw new ErrorApi(400, errores);
    await ejecutar(db, "UPDATE regimenes SET nombre = ?, regimen_servidor = ?, regimen_obrero = ?, verificado = ?, notas = ? WHERE codigo = ?",
      nombre, servidor, obrero, verificado, notas, codigo);
    return (await buscarRegimen(db, codigo))!;
  }

  const iessPersonal = rango("iessPersonal", "Aporte personal al IESS", 0, 1);
  const iessPatronal = rango("iessPatronal", "Aporte patronal al IESS", 0, 1);
  const recSup = rango("recargoSuplementarias", "Recargo de horas suplementarias", 0, 5);
  const recExt = rango("recargoExtraordinarias", "Recargo de horas extraordinarias", 0, 5);
  const recDes = rango("recargoDescanso", "Recargo de sábados, domingos y feriados", 0, 5);
  const recNoc = rango("recargoNocturno", "Recargo nocturno", 0, 5);
  const dias = rango("diasVacaciones", "Días de vacaciones", 0, 90, true);
  const fondos = rango("fondosReserva", "Fondos de reserva", 0, 1);
  const meses = rango("mesesParaFondos", "Meses para fondos de reserva", 0, 120, true);
  const topeSup = tope("topeSuplementariasMes", "Tope de horas suplementarias");
  const topeExt = tope("topeExtraordinariasMes", "Tope de horas extraordinarias");
  if (errores.length) throw new ErrorApi(400, errores);

  await ejecutar(
    db,
    `UPDATE regimenes SET nombre = ?, iess_personal = ?, iess_patronal = ?, recargo_suplementarias = ?,
       recargo_extraordinarias = ?, recargo_descanso = ?, recargo_nocturno = ?, tope_suplementarias_mes = ?,
       tope_extraordinarias_mes = ?, dias_vacaciones = ?, fondos_reserva = ?, meses_para_fondos = ?,
       aplica_decimo_tercero = ?, aplica_decimo_cuarto = ?, aplica_fondos_reserva = ?, aplica_horas_extras = ?,
       verificado = ?, notas = ? WHERE codigo = ?`,
    nombre, iessPersonal, iessPatronal, recSup, recExt, recDes, recNoc, topeSup, topeExt, dias, fondos, meses,
    bool("aplicaDecimoTercero"), bool("aplicaDecimoCuarto"), bool("aplicaFondosReserva"), bool("aplicaHorasExtras"),
    verificado, notas, codigo,
  );
  return (await buscarRegimen(db, codigo))!;
}
