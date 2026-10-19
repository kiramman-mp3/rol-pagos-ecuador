import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { aDecimal, cedulaValida, fechaIsoValida } from "../src/validaciones.ts";

describe("cedulaValida", () => {
  it("acepta una cédula correcta", () => assert.ok(cedulaValida("1801234566")));
  it("rechaza dígito verificador incorrecto", () => assert.ok(!cedulaValida("1801234567")));
  it("rechaza provincia inexistente", () => assert.ok(!cedulaValida("9901234566")));
  it("rechaza longitud incorrecta", () => assert.ok(!cedulaValida("18012345")));
  it("rechaza caracteres no numéricos", () => assert.ok(!cedulaValida("18012A4566")));
});

describe("aDecimal", () => {
  it("acepta coma o punto", () => assert.equal(aDecimal("12,5").toNumber(), 12.5));
  it("vacío o ausente es cero", () => {
    assert.equal(aDecimal("").toNumber(), 0);
    assert.equal(aDecimal(undefined).toNumber(), 0);
  });
  it("conserva los decimales exactos de un número JSON", () => {
    assert.equal(aDecimal(11.36).toString(), "11.36");
  });
  it("rechaza texto, negativos y NaN", () => {
    assert.throws(() => aDecimal("abc"));
    assert.throws(() => aDecimal("-1"));
    assert.throws(() => aDecimal("NaN"));
    assert.throws(() => aDecimal({}));
  });
});

describe("fechaIsoValida", () => {
  it("valida fechas reales", () => {
    assert.ok(fechaIsoValida("2024-02-29"));
    assert.ok(!fechaIsoValida("2025-02-29"));
    assert.ok(!fechaIsoValida("2025-13-01"));
    assert.ok(!fechaIsoValida("10/01/2025"));
    assert.ok(!fechaIsoValida(20250101));
  });
});
