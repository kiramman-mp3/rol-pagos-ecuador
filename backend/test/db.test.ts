import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { describe, it } from "node:test";

import { abrirBase, aPlaceholders, consultar, migrar, uno, versionEsquema } from "../src/db.ts";

const ULTIMA = readdirSync(new URL("../src/migraciones/", import.meta.url))
  .filter((f) => f.endsWith(".sql"))
  .length;

describe("migraciones del esquema", () => {
  it("una base nueva queda en la última versión", async () => {
    const db = await abrirBase(":memory:");
    assert.equal(await versionEsquema(db), ULTIMA);
    await db.cerrar();
  });

  it("migrar otra vez no repite migraciones ni duplica datos", async () => {
    const db = await abrirBase(":memory:");
    try {
      const contar = async () => ({
        tablas: Number((await uno(db, "SELECT COUNT(*) AS n FROM information_schema.columns WHERE table_schema = 'public'"))?.n),
        regimenes: Number((await uno(db, "SELECT COUNT(*) AS n FROM regimenes"))?.n),
        escala: Number((await uno(db, "SELECT COUNT(*) AS n FROM escala_salarial"))?.n),
        puestos: Number((await uno(db, "SELECT COUNT(*) AS n FROM puestos"))?.n),
      });
      const antes = await contar();
      await migrar(db);
      assert.equal(await versionEsquema(db), ULTIMA);
      assert.deepEqual(await contar(), antes);
    } finally {
      await db.cerrar();
    }
  });

  it("los puestos de ejemplo traen su id escrito y el siguiente sigue desde ahí", async () => {
    const db = await abrirBase(":memory:");
    try {
      const nuevo = await uno(
        db,
        `INSERT INTO puestos (nombre, funcion, responsabilidad, sector, escala_id)
         VALUES ('Nuevo', 'f', 'r', 's', NULL) RETURNING id`,
      );
      assert.equal(nuevo?.id, 6);
      assert.equal((await consultar(db, "SELECT id FROM puestos ORDER BY id")).length, 6);
    } finally {
      await db.cerrar();
    }
  });

  it("los números salen como números y las transacciones se deshacen si algo falla", async () => {
    const db = await abrirBase(":memory:");
    try {
      const fila = await uno(db, "SELECT COUNT(*) AS n, SUM(rmu) AS suma FROM escala_salarial");
      assert.equal(typeof fila?.n, "number");
      assert.equal(typeof fila?.suma, "number");

      await assert.rejects(
        db.transaccion(async (tx) => {
          await tx.consultar("DELETE FROM escala_salarial", []);
          throw new Error("falla a medias");
        }),
        /falla a medias/,
      );
      assert.equal((await uno(db, "SELECT COUNT(*) AS n FROM escala_salarial"))?.n, fila?.n);
    } finally {
      await db.cerrar();
    }
  });
});

describe("placeholders", () => {
  it("cambia ? por $1, $2… sin tocar los que están dentro de un texto", () => {
    assert.equal(
      aPlaceholders("SELECT * FROM t WHERE a = ? AND b = '¿?' AND c = ?"),
      "SELECT * FROM t WHERE a = $1 AND b = '¿?' AND c = $2",
    );
  });
});
