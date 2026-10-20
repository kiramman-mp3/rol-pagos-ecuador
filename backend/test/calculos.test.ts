import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  calcularRol,
  diasTrabajados,
  impuestoRentaAnual,
  mesesDeServicio,
  REGLAS_CT_2026,
  avisosDeTopes,
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
      horasSuplementarias: 10, horasDescanso: 5, horasNocturnas: 20, comisiones: 100,
    });
    assert.equal(r.valorHorasSuplementarias, 60); // 10 * 4 * 1.5
    assert.equal(r.valorHorasDescanso, 40); // 5 * 4 * 2
    assert.equal(r.valorRecargoNocturno, 20); // 20 * 4 * 0.25
    assert.equal(r.totalIngresos, 1180);
    assert.equal(r.aporteIess, 111.51); // 1180 * 9.45%, redondeado
  });

  it("un empate exacto de centavos sube (16273.2 / 240 = 67.805)", () => {
    const r = calcularRol({
      sueldoBase: 955, fechaIngreso: ANTIGUO, anio: 2026, mes: 10, horasSuplementarias: "11.36",
    });
    assert.equal(r.valorHorasSuplementarias, 67.81);
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
      { sueldoBase: 960, fechaIngreso: ANTIGUO, anio: 2026, mes: 10, horasSuplementarias: 10, horasDescanso: 5 },
      { ...REGLAS_CT_2026, recargoSuplementarias: "0.25", recargoDescanso: "0.6" },
    );
    assert.equal(r.valorHorasSuplementarias, 50); // 10 * 4 * 1.25
    assert.equal(r.valorHorasDescanso, 32); // 5 * 4 * 1.6
  });

  it("las horas extraordinarias tienen su propio recargo", () => {
    // valor hora = 960 / 240 = 4.00; extraordinarias al 60% (LOSEP)
    const r = calcularRol(
      { sueldoBase: 960, fechaIngreso: ANTIGUO, anio: 2026, mes: 10, horasExtraordinarias: 10 },
      { ...REGLAS_CT_2026, recargoExtraordinarias: "0.6" },
    );
    assert.equal(r.valorHorasExtraordinarias, 64); // 10 * 4 * 1.6
    assert.equal(r.totalIngresos, 1024);
    // En el Código del Trabajo son al 100%.
    const ct = calcularRol({ sueldoBase: 960, fechaIngreso: ANTIGUO, anio: 2026, mes: 10, horasExtraordinarias: 10 });
    assert.equal(ct.valorHorasExtraordinarias, 80);
  });

  it("los tres tipos de horas se suman al ingreso", () => {
    const r = calcularRol({
      sueldoBase: 960, fechaIngreso: ANTIGUO, anio: 2026, mes: 10,
      horasSuplementarias: 10, horasExtraordinarias: 5, horasDescanso: 5, horasNocturnas: 20,
    });
    assert.equal(r.totalIngresos, 960 + 60 + 40 + 40 + 20);
  });

  it("la tabla del IR de las reglas define el impuesto", () => {
    const sinImpuesto = calcularRol(base, {
      ...REGLAS_CT_2026,
      tablaIr: [{ desde: 0, hasta: null, cuota: 0, porcentaje: 0 }],
    });
    assert.equal(sinImpuesto.impuestoRenta, 0);
    assert.equal(sinImpuesto.netoPagar, 1811); // 2000 - 189 de IESS
  });

  it("las vacaciones incluyen las horas extras y las comisiones (art. 71)", () => {
    // sueldo 960 + 10 h suplementarias (60) + 100 de comisión = 1120; 1120 / 24 = 46.67
    const r = calcularRol({
      sueldoBase: 960, fechaIngreso: ANTIGUO, anio: 2026, mes: 10,
      horasSuplementarias: 10, comisiones: 100,
    });
    assert.equal(r.vacaciones, 46.67);
  });

  it("los días de vacaciones del régimen definen la provisión", () => {
    const r = calcularRol(base, { ...REGLAS_CT_2026, diasVacaciones: 30 });
    assert.equal(r.vacaciones, 166.67); // 2000 * 30 / 360
  });

  it("los meses para generar fondos de reserva son configurables", () => {
    const entrada = { ...base, fechaIngreso: "2026-04-01" }; // 6 meses de servicio
    assert.equal(calcularRol(entrada).fondosReserva, 0);
    assert.equal(calcularRol(entrada, { ...REGLAS_CT_2026, mesesParaFondos: 6 }).fondosReserva, 166.6);
  });
});

describe("avisosDeTopes", () => {
  const reglas = { ...REGLAS_CT_2026, topeSuplementariasMes: 60, topeExtraordinariasMes: 60 };

  it("no avisa si las horas están dentro del tope", () => {
    assert.deepEqual(
      avisosDeTopes("Ana", { horasSuplementarias: 60, horasExtraordinarias: 10 }, reglas), [],
    );
  });

  it("avisa cada tipo que pasa el tope", () => {
    const avisos = avisosDeTopes("Ana", { horasSuplementarias: 61, horasExtraordinarias: 80 }, reglas);
    assert.equal(avisos.length, 2);
    assert.match(avisos[0], /Ana.*suplementarias.*60/);
    assert.match(avisos[1], /extraordinarias/);
  });

  it("un tope nulo significa sin tope mensual", () => {
    const sinTope = { ...reglas, topeExtraordinariasMes: null };
    assert.deepEqual(avisosDeTopes("Ana", { horasSuplementarias: 0, horasExtraordinarias: 500 }, sinTope), []);
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
