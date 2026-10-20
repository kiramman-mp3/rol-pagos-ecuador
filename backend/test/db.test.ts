import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";

import { abrirBase, versionEsquema } from "../src/db.ts";

const ULTIMA = readdirSync(new URL("../src/migraciones/", import.meta.url))
  .filter((f) => f.endsWith(".sql"))
  .length;

describe("migraciones del esquema", () => {
  it("una base nueva queda en la última versión", () => {
    const db = abrirBase(":memory:");
    assert.equal(versionEsquema(db), ULTIMA);
    db.close();
  });

  it("abrir la misma base dos veces no repite migraciones ni duplica datos", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "rol-"));
    try {
      const ruta = join(carpeta, "rol.db");
      const primera = abrirBase(ruta);
      const objetos = (db: DatabaseSync) =>
        Number((db.prepare("SELECT COUNT(*) AS n FROM sqlite_master").get() as { n: number }).n);
      const antes = objetos(primera);
      primera.close();

      const segunda = abrirBase(ruta);
      assert.equal(versionEsquema(segunda), ULTIMA);
      assert.equal(objetos(segunda), antes);
      segunda.close();
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });

  it("una base anterior a las migraciones (versión 0) se actualiza sin perder datos", () => {
    const carpeta = mkdtempSync(join(tmpdir(), "rol-"));
    try {
      const ruta = join(carpeta, "vieja.db");
      // Esquema original: tablas creadas sin ningún número de versión.
      const vieja = new DatabaseSync(ruta);
      vieja.exec(`CREATE TABLE empleados (
        id INTEGER PRIMARY KEY AUTOINCREMENT, cedula TEXT NOT NULL UNIQUE, nombres TEXT NOT NULL,
        cargo TEXT NOT NULL, sueldo_base REAL NOT NULL, fecha_ingreso TEXT NOT NULL,
        tipo_contrato TEXT NOT NULL, activo INTEGER NOT NULL DEFAULT 1)`);
      vieja.exec(`INSERT INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso, tipo_contrato)
        VALUES ('1801234566', 'Ana Antigua', 'Analista', 900, '2020-01-01', 'Indefinido')`);
      vieja.close();

      const db = abrirBase(ruta);
      assert.equal(versionEsquema(db), ULTIMA);
      const ana = db.prepare("SELECT nombres, sueldo_base FROM empleados").get() as {
        nombres: string; sueldo_base: number;
      };
      assert.equal(ana.nombres, "Ana Antigua");
      assert.equal(ana.sueldo_base, 900);
      db.close();
    } finally {
      rmSync(carpeta, { recursive: true, force: true });
    }
  });
});
