/** Validaciones de formulario: cédula ecuatoriana, números y fechas. */
import { Decimal } from "decimal.js";

/** Error con código HTTP y la lista de mensajes que verá el usuario. */
export class ErrorApi extends Error {
  status: number;
  errores: string[];

  constructor(status: number, errores: string[]) {
    super(errores.join(" "));
    this.status = status;
    this.errores = errores;
  }
}

/** Algoritmo módulo 10 del Registro Civil (personas naturales). */
export function cedulaValida(cedula: string): boolean {
  if (!/^\d{10}$/.test(cedula)) return false;
  const provincia = Number(cedula.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30) || Number(cedula[2]) > 5) {
    return false;
  }
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    const producto = Number(cedula[i]) * (i % 2 === 0 ? 2 : 1);
    suma += producto > 9 ? producto - 9 : producto;
  }
  return (10 - (suma % 10)) % 10 === Number(cedula[9]);
}

/**
 * Convierte el valor de un campo a Decimal; vacío o ausente = 0.
 * Acepta números y textos con coma o punto. Lanza Error si no es válido.
 */
export function aDecimal(valor: unknown, minimo = 0): Decimal {
  const vacio = valor === undefined || valor === null || String(valor).trim() === "";
  if (!vacio && typeof valor !== "number" && typeof valor !== "string") {
    throw new Error("no es un número");
  }
  const texto = vacio ? "0" : String(valor).trim().replace(",", ".");
  let numero: Decimal;
  try {
    numero = new Decimal(texto);
  } catch {
    throw new Error(`'${texto}' no es un número`);
  }
  if (!numero.isFinite()) throw new Error(`'${texto}' no es un número`);
  // El vacío cuenta como 0, pero igual debe cumplir el mínimo del campo.
  if (numero.lt(minimo)) throw new Error(`debe ser mayor o igual a ${minimo}`);
  return numero;
}

/** AAAA-MM-DD que existe en el calendario. */
export function fechaIsoValida(valor: unknown): valor is string {
  if (typeof valor !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const [anio, mes, dia] = valor.split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  return (
    fecha.getUTCFullYear() === anio && fecha.getUTCMonth() === mes - 1 && fecha.getUTCDate() === dia
  );
}
