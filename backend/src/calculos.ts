/**
 * Motor de cálculo del rol de pagos (Ecuador).
 *
 * Funciones puras: no tocan la base de datos ni Express. Todo el dinero se maneja
 * con Decimal y se redondea a centavos (ROUND_HALF_UP) en cada rubro, para que
 * las columnas del rol sumen exactamente el total que se muestra.
 *
 * Las reglas de ley (SBU, aportes, recargos, tabla del IR) llegan como parámetro
 * (`ReglasRol`): salen de la base de datos según el año y el régimen del empleado.
 */
import { Decimal } from "decimal.js";

// Precisión alta para que ninguna división intermedia mueva un empate de centavos.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

type Monto = Decimal.Value;

const D = (valor: Monto) => new Decimal(valor);

const DIAS_MES = D(30); // mes comercial laboral

export interface TramoIR {
  /** límite inferior de la fracción básica */
  desde: number;
  /** límite superior; null en el último tramo */
  hasta: number | null;
  /** impuesto sobre la fracción básica */
  cuota: number;
  /** % sobre el excedente, como fracción (0.05 = 5%) */
  porcentaje: number;
}

/**
 * Todo lo que la ley fija y puede cambiar: lo define el año (SBU, tabla del IR)
 * y el régimen laboral del empleado (aportes, recargos, vacaciones).
 */
export interface ReglasRol {
  /** Salario Básico Unificado */
  sbu: Monto;
  /** aporte del trabajador, como fracción (0.0945 = 9.45%) */
  iessPersonal: Monto;
  /** aporte del empleador */
  iessPatronal: Monto;
  /** fondos de reserva, como fracción del ingreso aportable */
  fondosReserva: Monto;
  /** meses de servicio cumplidos antes de generar fondos de reserva */
  mesesParaFondos: number;
  /** base del valor hora: 30 días x 8 horas */
  horasMes: number;
  /** recargo de las horas suplementarias sobre la hora normal (0.5 = +50%) */
  recargoSuplementarias: Monto;
  /** recargo de las horas en días de descanso: sábados, domingos y feriados */
  recargoDescanso: Monto;
  /** recargo del trabajo nocturno: solo el recargo, la hora base ya está en el sueldo */
  recargoNocturno: Monto;
  tablaIr: readonly TramoIR[];
}

/** Tabla SRI 2026, personas naturales (Res. NAC-DGERCGC25-00000043). */
export const TABLA_IR_2026: readonly TramoIR[] = [
  { desde: 0, hasta: 12208, cuota: 0, porcentaje: 0 },
  { desde: 12208, hasta: 15549, cuota: 0, porcentaje: 0.05 },
  { desde: 15549, hasta: 20188, cuota: 167, porcentaje: 0.1 },
  { desde: 20188, hasta: 26700, cuota: 631, porcentaje: 0.12 },
  { desde: 26700, hasta: 35136, cuota: 1412, porcentaje: 0.15 },
  { desde: 35136, hasta: 46575, cuota: 2678, porcentaje: 0.2 },
  { desde: 46575, hasta: 62005, cuota: 4965, porcentaje: 0.25 },
  { desde: 62005, hasta: 82679, cuota: 8823, porcentaje: 0.3 },
  { desde: 82679, hasta: 109956, cuota: 15025, porcentaje: 0.35 },
  { desde: 109956, hasta: null, cuota: 24572, porcentaje: 0.37 },
];

/**
 * Código del Trabajo con los valores de 2026 (arts. 49 y 55). Es el valor por
 * defecto del motor y lo que usan las pruebas; el sistema real lo arma con
 * `reglasDe` a partir de la base de datos.
 */
export const REGLAS_CT_2026: ReglasRol = {
  sbu: 482,
  iessPersonal: "0.0945",
  iessPatronal: "0.1115",
  fondosReserva: "0.0833",
  mesesParaFondos: 12,
  horasMes: 240,
  recargoSuplementarias: "0.5",
  recargoDescanso: 1,
  recargoNocturno: "0.25",
  tablaIr: TABLA_IR_2026,
};

/** Redondea a centavos. */
export function q(valor: Monto): Decimal {
  return D(valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Aplica la tabla progresiva: cuota fija del tramo + % sobre el excedente. */
export function impuestoRentaAnual(baseAnual: Monto, tabla: readonly TramoIR[] = TABLA_IR_2026): Decimal {
  const base = D(baseAnual);
  if (base.lte(0)) return D("0.00");
  for (const t of tabla) {
    if (t.hasta === null || base.lte(t.hasta)) {
      return q(D(t.cuota).plus(base.minus(t.desde).times(t.porcentaje)));
    }
  }
  throw new Error("la tabla debe cubrir todos los valores");
}

export interface RetencionIR {
  baseAnual: Decimal;
  irAnual: Decimal;
  irMensual: Decimal;
}

/** Proyecta el año (x12), resta el IESS (deducible) y reparte el IR en 12 cuotas. */
export function retencionIrMensual(
  ingresosGravados: Monto, aporteIess: Monto, tabla: readonly TramoIR[] = TABLA_IR_2026,
): RetencionIR {
  const baseAnual = Decimal.max(0, D(ingresosGravados).minus(aporteIess).times(12));
  const irAnual = impuestoRentaAnual(baseAnual, tabla);
  return { baseAnual: q(baseAnual), irAnual, irMensual: q(irAnual.div(12)) };
}

/** Fecha de ingreso como la guarda la base: AAAA-MM-DD. */
function partesFecha(fechaIngreso: string): { anio: number; mes: number; dia: number } {
  const [anio, mes, dia] = fechaIngreso.split("-").map(Number);
  return { anio, mes, dia };
}

/** Meses calendario transcurridos entre el mes de ingreso y el período. */
export function mesesDeServicio(fechaIngreso: string, anio: number, mes: number): number {
  const f = partesFecha(fechaIngreso);
  return (anio - f.anio) * 12 + (mes - f.mes);
}

/** 30 días, salvo el mes de ingreso, que se prorratea desde el día de ingreso. */
export function diasTrabajados(fechaIngreso: string, anio: number, mes: number): number {
  const f = partesFecha(fechaIngreso);
  if (f.anio === anio && f.mes === mes) return Math.max(1, Math.min(30, 30 - f.dia + 1));
  return 30;
}

export interface EntradaRol {
  sueldoBase: Monto;
  /** AAAA-MM-DD */
  fechaIngreso: string;
  anio: number;
  mes: number;
  horas50?: Monto;
  horas100?: Monto;
  horasNocturnas?: Monto;
  comisiones?: Monto;
  otrosDescuentos?: Monto;
}

/** Resultado en números de dos decimales, listo para JSON y para la base. */
export interface ResultadoRol {
  // contexto
  diasTrabajados: number;
  mesesServicio: number;
  valorHora: number;
  // ingresos
  sueldo: number;
  horas50: number;
  horas100: number;
  horasNocturnas: number;
  valorHoras50: number;
  valorHoras100: number;
  valorRecargoNocturno: number;
  comisiones: number;
  totalIngresos: number;
  // descuentos
  aporteIess: number;
  baseIrAnual: number;
  irAnual: number;
  impuestoRenta: number;
  otrosDescuentos: number;
  totalDescuentos: number;
  // neto
  netoPagar: number;
  // provisiones y costo empleador (no afectan el neto)
  decimoTercero: number;
  decimoCuarto: number;
  vacaciones: number;
  fondosReserva: number;
  aportePatronal: number;
  totalProvisiones: number;
  costoEmpleador: number;
}

export function calcularRol(entrada: EntradaRol, reglas: ReglasRol = REGLAS_CT_2026): ResultadoRol {
  const sbu = D(reglas.sbu);
  const horasMes = D(reglas.horasMes);
  const sueldoBase = D(entrada.sueldoBase);
  const horas50 = D(entrada.horas50 ?? 0);
  const horas100 = D(entrada.horas100 ?? 0);
  const horasNocturnas = D(entrada.horasNocturnas ?? 0);
  const comisiones = q(entrada.comisiones ?? 0);
  const otrosDescuentos = q(entrada.otrosDescuentos ?? 0);

  const dias = diasTrabajados(entrada.fechaIngreso, entrada.anio, entrada.mes);
  const meses = mesesDeServicio(entrada.fechaIngreso, entrada.anio, entrada.mes);

  // Ingresos. El valor hora sale del sueldo completo, aunque el mes se prorratee.
  // Se multiplica antes de dividir: así 16273.2 / 240 da exactamente 67.805.
  const valorHora = sueldoBase.div(horasMes);
  const sueldo = q(sueldoBase.times(dias).div(DIAS_MES));
  const porHora = (horas: Decimal, multiplicador: Decimal) =>
    q(horas.times(sueldoBase).times(multiplicador).div(horasMes));
  const v50 = porHora(horas50, D(1).plus(reglas.recargoSuplementarias));
  const v100 = porHora(horas100, D(1).plus(reglas.recargoDescanso));
  const vNoc = porHora(horasNocturnas, D(reglas.recargoNocturno));
  const totalIngresos = sueldo.plus(v50).plus(v100).plus(vNoc).plus(comisiones);

  // Descuentos. Todo el ingreso aquí es gravado con IESS.
  const iess = q(totalIngresos.times(reglas.iessPersonal));
  const ir = retencionIrMensual(totalIngresos, iess, reglas.tablaIr);
  const totalDescuentos = iess.plus(ir.irMensual).plus(otrosDescuentos);
  const neto = totalIngresos.minus(totalDescuentos);

  // Provisiones del empleador: se muestran, no se descuentan.
  const decimoTercero = q(totalIngresos.div(12));
  const decimoCuarto = q(sbu.times(dias).div(12 * 30)); // sobre el SBU, no el sueldo
  const vacaciones = q(sueldo.div(24));
  const fondos = meses >= reglas.mesesParaFondos ? q(totalIngresos.times(reglas.fondosReserva)) : D("0.00");
  const patronal = q(totalIngresos.times(reglas.iessPatronal));
  const provisiones = decimoTercero.plus(decimoCuarto).plus(vacaciones).plus(fondos).plus(patronal);

  return {
    diasTrabajados: dias,
    mesesServicio: meses,
    valorHora: q(valorHora).toNumber(),
    sueldo: sueldo.toNumber(),
    horas50: horas50.toNumber(),
    horas100: horas100.toNumber(),
    horasNocturnas: horasNocturnas.toNumber(),
    valorHoras50: v50.toNumber(),
    valorHoras100: v100.toNumber(),
    valorRecargoNocturno: vNoc.toNumber(),
    comisiones: comisiones.toNumber(),
    totalIngresos: totalIngresos.toNumber(),
    aporteIess: iess.toNumber(),
    baseIrAnual: ir.baseAnual.toNumber(),
    irAnual: ir.irAnual.toNumber(),
    impuestoRenta: ir.irMensual.toNumber(),
    otrosDescuentos: otrosDescuentos.toNumber(),
    totalDescuentos: totalDescuentos.toNumber(),
    netoPagar: neto.toNumber(),
    decimoTercero: decimoTercero.toNumber(),
    decimoCuarto: decimoCuarto.toNumber(),
    vacaciones: vacaciones.toNumber(),
    fondosReserva: fondos.toNumber(),
    aportePatronal: patronal.toNumber(),
    totalProvisiones: provisiones.toNumber(),
    costoEmpleador: totalIngresos.plus(provisiones).toNumber(),
  };
}
