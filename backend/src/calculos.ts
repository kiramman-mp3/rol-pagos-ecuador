/**
 * Motor de cálculo del rol de pagos (Ecuador 2026).
 *
 * Funciones puras: no tocan la base de datos ni Express. Todo el dinero se maneja
 * con Decimal y se redondea a centavos (ROUND_HALF_UP) en cada rubro, para que
 * las columnas del rol sumen exactamente el total que se muestra.
 */
import { Decimal } from "decimal.js";

// Precisión alta para que ninguna división intermedia mueva un empate de centavos.
Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

type Monto = Decimal.Value;

const D = (valor: Monto) => new Decimal(valor);

// --- Parámetros de ley 2026 -------------------------------------------------
export const SBU = D(482); // Salario Básico Unificado 2026
export const IESS_PERSONAL = D("0.0945"); // aporte del trabajador
export const IESS_PATRONAL = D("0.1115"); // aporte del empleador
export const FONDOS_RESERVA = D("0.0833"); // 8.33% desde el mes 13
const HORAS_MES = D(240); // 30 días x 8 horas: base del valor hora
const DIAS_MES = D(30); // mes comercial laboral

// Multiplicador sobre el valor hora, según Código del Trabajo (art. 55 y 49)
const RECARGO_50 = D("1.5"); // suplementarias (hasta 4 h diarias)
const RECARGO_100 = D(2); // extraordinarias: sábados, domingos, feriados
const RECARGO_NOCTURNO = D("0.25"); // solo el recargo: la hora base ya está en el sueldo

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

/** Redondea a centavos. */
export function q(valor: Monto): Decimal {
  return D(valor).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
}

/** Aplica la tabla progresiva: cuota fija del tramo + % sobre el excedente. */
export function impuestoRentaAnual(baseAnual: Monto): Decimal {
  const base = D(baseAnual);
  if (base.lte(0)) return D("0.00");
  for (const t of TABLA_IR_2026) {
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
export function retencionIrMensual(ingresosGravados: Monto, aporteIess: Monto): RetencionIR {
  const baseAnual = Decimal.max(0, D(ingresosGravados).minus(aporteIess).times(12));
  const irAnual = impuestoRentaAnual(baseAnual);
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

export function calcularRol(entrada: EntradaRol): ResultadoRol {
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
  const valorHora = sueldoBase.div(HORAS_MES);
  const sueldo = q(sueldoBase.times(dias).div(DIAS_MES));
  const porHora = (horas: Decimal, recargo: Decimal) =>
    q(horas.times(sueldoBase).times(recargo).div(HORAS_MES));
  const v50 = porHora(horas50, RECARGO_50);
  const v100 = porHora(horas100, RECARGO_100);
  const vNoc = porHora(horasNocturnas, RECARGO_NOCTURNO);
  const totalIngresos = sueldo.plus(v50).plus(v100).plus(vNoc).plus(comisiones);

  // Descuentos. Todo el ingreso aquí es gravado con IESS.
  const iess = q(totalIngresos.times(IESS_PERSONAL));
  const ir = retencionIrMensual(totalIngresos, iess);
  const totalDescuentos = iess.plus(ir.irMensual).plus(otrosDescuentos);
  const neto = totalIngresos.minus(totalDescuentos);

  // Provisiones del empleador: se muestran, no se descuentan.
  const decimoTercero = q(totalIngresos.div(12));
  const decimoCuarto = q(SBU.times(dias).div(12 * 30)); // sobre el SBU, no el sueldo
  const vacaciones = q(sueldo.div(24));
  const fondos = meses >= 12 ? q(totalIngresos.times(FONDOS_RESERVA)) : D("0.00");
  const patronal = q(totalIngresos.times(IESS_PATRONAL));
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
