import { Pipe, PipeTransform } from '@angular/core';

const formato = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** 1234.5 -> $1,234.50 (el dólar es la moneda de Ecuador). */
@Pipe({ name: 'dinero' })
export class DineroPipe implements PipeTransform {
  transform(valor: number | null | undefined): string {
    return formato.format(valor ?? 0);
  }
}

/** Suma de valores con dos decimales exactos (evita 0.1 + 0.2). */
export function sumar(valores: number[]): number {
  return Math.round(valores.reduce((total, v) => total + v * 100, 0)) / 100;
}
