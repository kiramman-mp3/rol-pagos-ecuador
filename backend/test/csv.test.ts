import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { BOM, celdaCsv, documentoCsv } from "../src/csv.ts";

describe("CSV para Excel", () => {
  it("empieza con la marca UTF-8 para que Excel lea bien las tildes", () => {
    assert.equal(documentoCsv(["a"], []).charCodeAt(0), 0xfeff);
    assert.equal(BOM.length, 1);
  });

  it("escribe encabezado y filas separados por saltos de línea", () => {
    const csv = documentoCsv(["nombre", "valor"], [["Ana", 10], ["Beto", 2.5]]);
    assert.equal(csv, `${BOM}nombre,valor\nAna,10\nBeto,2.5\n`);
  });

  it("entrecomilla lo que tiene comas, comillas o saltos de línea", () => {
    assert.equal(celdaCsv("Pérez, Ana"), '"Pérez, Ana"');
    assert.equal(celdaCsv('dijo "hola"'), '"dijo ""hola"""');
    assert.equal(celdaCsv("dos\nlíneas"), '"dos\nlíneas"');
    assert.equal(celdaCsv("simple"), "simple");
  });

  it("las celdas vacías o nulas quedan en blanco y el cero se conserva", () => {
    assert.equal(celdaCsv(null), "");
    assert.equal(celdaCsv(undefined), "");
    assert.equal(celdaCsv(0), "0");
  });
});
