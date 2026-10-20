import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calcularRol,
  diasTrabajados,
  impuestoRentaAnual,
  mesesDeServicio,
  REGLAS_CT_2026,
} from "../src/calculos.ts";

const ANTIGUO = "2020-01-15";

describe("impuestoRentaAnual", () => {
  const casos: [number, number][] = [
    [0, 0],
    [12208, 0], // fracción básica exenta
    [15549, 167.05], // fin del tramo 5%: 3341 * 5%
    [21732, 816.28], // 631 + (21732-20188) * 12%
    [30000, 1907], // 1412 + (30000-26700) * 15%
    [120000, 28288.28], // 24572 + (120000-109956) * 37%
  ];
  for (const [base, esperado] of casos) {
    it(`base ${base} -> ${esperado}`, () => {
      assert.equal(impuestoRentaAnual(base).toNumber(), esperado);
    });
  }
});

describe("calcularRol", () => {
  it("un sueldo bajo no paga impuesto a la renta", () => {
    const r = calcularRol({ sueldoBase: 482, fechaIngreso: ANTIGUO, anio: 2026, mes: 10 });
    assert.equal(r.aporteIess, 45.55);
    assert.equal(r.impuestoRenta, 0);
    assert.equal(r.netoPagar, 436.45);
  });

  it("rol completo con sueldo de 2000", () => {
    const r = calcularRol({ sueldoBase: 2000, fechaIngreso: ANTIGUO, anio: 2026, mes: 10 });
    assert.equal(r.totalIngresos, 2000);
    assert.equal(r.aporteIess, 189); // 9.45%
    assert.equal(r.baseIrAnual, 21732); // (2000-189)*12
    assert.equal(r.impuestoRenta, 68.02); // 816.28 / 12
    assert.equal(r.netoPagar, 1742.98);
    assert.equal(r.decimoTercero, 166.67);
    assert.equal(r.decimoCuarto, 40.17); // SBU/12, no el sueldo
    assert.equal(r.vacaciones, 83.33);
    assert.equal(r.fondosReserva, 166.6); // 8.33%
    assert.equal(r.aportePatronal, 223); // 11.15%
    assert.equal(r.costoEmpleador, Number((2000 + r.totalProvisiones).toFixed(2)));
  });

  it("las provisiones no afectan el neto", () => {
    const r = calcularRol({ sueldoBase: 1500, fechaIngreso: ANTIGUO, anio: 2026, mes: 10 });
    assert.equal(r.netoPagar, Number((r.totalIngresos - r.totalDescuentos).toFixed(2)));
  });

  it("horas extras y comisiones", () => {
    // valor hora = 960 / 240 = 4.00
    const r = calcularRol({
      sueldoBase: 960, fechaIngreso: ANTIGUO, anio: 2026, mes: 10,
      horas50: 10, horas100: 5, horasNocturnas: 20, comisiones: 100,
    });
    assert.equal(r.valorHoras50, 60); // 10 * 4 * 1.5
    assert.equal(r.valorHoras100, 40); // 5 * 4 * 2
    assert.equal(r.valorRecargoNocturno, 20); // 20 * 4 * 0.25
    assert.equal(r.totalIngresos, 1180);
    assert.equal(r.aporteIess, 111.51); // 1180 * 9.45%, redondeado
  });

  it("un empate exacto de centavos sube (16273.2 / 240 = 67.805)", () => {
    const r = calcularRol({
      sueldoBase: 955, fechaIngreso: ANTIGUO, anio: 2026, mes: 10, horas50: "11.36",
    });
    assert.equal(r.valorHoras50, 67.81);
  });

  it("otros descuentos reducen el neto", () => {
    const base = { sueldoBase: 1000, fechaIngreso: ANTIGUO, anio: 2026, mes: 10 };
    const sin = calcularRol(base);
    const con = calcularRol({ ...base, otrosDescuentos: 50 });
    assert.equal(Number((sin.netoPagar - con.netoPagar).toFixed(2)), 50);
  });

  it("fondos de reserva desde el mes 13", () => {
    const ingreso = "2025-10-01";
    const en = (mes: number) => calcularRol({ sueldoBase: 1000, fechaIngreso: ingreso, anio: 2026, mes });
    assert.equal(en(9).fondosReserva, 0); // mes 12
    assert.equal(en(10).fondosReserva, 83.3); // mes 13
  });

  it("el mes de ingreso se prorratea", () => {
    const r = calcularRol({ sueldoBase: 1000, fechaIngreso: "2026-10-16", anio: 2026, mes: 10 });
    assert.equal(r.sueldo, 500);
    assert.equal(r.decimoCuarto, 20.08); // prorrateado también
  });
});

describe("reglas inyectadas", () => {
  const base = { sueldoBase: 2000, fechaIngreso: ANTIGUO, anio: 2026, mes: 10 };

  it("sin reglas usa el Código del Trabajo 2026", () => {
    assert.deepEqual(calcularRol(base), calcularRol(base, REGLAS_CT_2026));
  });

  it("el aporte al IESS sale de las reglas, no de una constante", () => {
    const r = calcularRol(base, { ...REGLAS_CT_2026, iessPersonal: "0.1145", iessPatronal: "0.0915" });
    assert.equal(r.aporteIess, 229); // 11.45% de 2000
    assert.equal(r.aportePatronal, 183); // 9.15%
  });

  it("el SBU de las reglas define el décimo cuarto", () => {
    const r = calcularRol(base, { ...REGLAS_CT_2026, sbu: 600 });
    assert.equal(r.decimoCuarto, 50); // 600 / 12
  });

  it("los recargos de las reglas definen el valor de las horas", () => {
    // valor hora = 960 / 240 = 4.00; suplementarias al 25% y descanso al 60%
    const r = calcularRol(
      { sueldoBase: 960, fechaIngreso: ANTIGUO, anio: 2026, mes: 10, horas50: 10, horas100: 5 },
      { ...REGLAS_CT_2026, recargoSuplementarias: "0.25", recargoDescanso: "0.6" },
    );
    assert.equal(r.valorHoras50, 50); // 10 * 4 * 1.25
    assert.equal(r.valorHoras100, 32); // 5 * 4 * 1.6
  });

  it("la tabla del IR de las reglas define el impuesto", () => {
    const sinImpuesto = calcularRol(base, {
      ...REGLAS_CT_2026,
      tablaIr: [{ desde: 0, hasta: null, cuota: 0, porcentaje: 0 }],
    });
    assert.equal(sinImpuesto.impuestoRenta, 0);
    assert.equal(sinImpuesto.netoPagar, 1811); // 2000 - 189 de IESS
  });

  it("los meses para generar fondos de reserva son configurables", () => {
    const entrada = { ...base, fechaIngreso: "2026-04-01" }; // 6 meses de servicio
    assert.equal(calcularRol(entrada).fondosReserva, 0);
    assert.equal(calcularRol(entrada, { ...REGLAS_CT_2026, mesesParaFondos: 6 }).fondosReserva, 166.6);
  });
});

describe("fechas", () => {
  it("diasTrabajados", () => {
    assert.equal(diasTrabajados("2026-10-16", 2026, 10), 15);
    assert.equal(diasTrabajados("2026-10-01", 2026, 10), 30);
    assert.equal(diasTrabajados("2026-10-31", 2026, 10), 1);
    assert.equal(diasTrabajados("2026-10-16", 2026, 11), 30);
  });
  it("mesesDeServicio", () => {
    assert.equal(mesesDeServicio("2025-10-20", 2026, 10), 12);
    assert.equal(mesesDeServicio("2026-10-01", 2026, 10), 0);
  });
});
