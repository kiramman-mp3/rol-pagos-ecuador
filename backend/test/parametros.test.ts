import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { iniciar } from "./ayuda.ts";
import type { Cliente } from "./ayuda.ts";

async function conApi(prueba: (api: Cliente) => Promise<void>) {
  const api = await iniciar();
  try {
    await prueba(api);
  } finally {
    api.cerrar();
  }
}

const TABLA_SIMPLE = [
  { desde: 0, hasta: 13000, cuota: 0, porcentaje: 0 },
  { desde: 13000, hasta: null, cuota: 0, porcentaje: 0.1 },
];

describe("parámetros anuales", () => {
  it("2026 viene cargado desde la base", () =>
    conApi(async (api) => {
      const p = (await api.get("/api/parametros?anio=2026")).json;
      assert.equal(p.anio, 2026);
      assert.equal(p.exacto, true);
      assert.equal(p.sbu, 482);
      assert.equal(p.fraccionExentaIr, 12208);
      assert.equal(p.tablaIr.length, 10);
      assert.deepEqual(p.anios, [2026]);
    }));

  it("un año sin parámetros usa el más reciente anterior y lo indica", () =>
    conApi(async (api) => {
      const p = (await api.get("/api/parametros?anio=2030")).json;
      assert.equal(p.anio, 2026);
      assert.equal(p.anioSolicitado, 2030);
      assert.equal(p.exacto, false);
    }));

  it("crea los parámetros de un año nuevo", () =>
    conApi(async (api) => {
      const r = await api.put("/api/parametros/2027", { sbu: 500, tablaIr: TABLA_SIMPLE, fuente: "Prueba" });
      assert.equal(r.status, 200);
      const p = (await api.get("/api/parametros?anio=2027")).json;
      assert.equal(p.sbu, 500);
      assert.equal(p.exacto, true);
      assert.equal(p.fraccionExentaIr, 13000);
      assert.deepEqual(p.anios, [2027, 2026]);
    }));

  it("actualiza un año existente sin duplicarlo", () =>
    conApi(async (api) => {
      await api.put("/api/parametros/2026", { sbu: 490, tablaIr: TABLA_SIMPLE });
      const p = (await api.get("/api/parametros?anio=2026")).json;
      assert.equal(p.sbu, 490);
      assert.deepEqual(p.anios, [2026]);
    }));

  it("rechaza un SBU inválido y una tabla mal formada, con todos los motivos", () =>
    conApi(async (api) => {
      const sbu = await api.put("/api/parametros/2027", { sbu: 0, tablaIr: TABLA_SIMPLE });
      assert.equal(sbu.status, 400);
      assert.match(sbu.json.errores[0], /SBU/);

      const tabla = await api.put("/api/parametros/2027", {
        sbu: 500,
        tablaIr: [
          { desde: 5, hasta: 100, cuota: 0, porcentaje: 0 },
          { desde: 150, hasta: 200, cuota: -1, porcentaje: 2 },
        ],
      });
      assert.equal(tabla.status, 400);
      assert.ok(tabla.json.errores.length >= 4);
      assert.equal((await api.get("/api/parametros?anio=2027")).json.exacto, false);
    }));

  it("rechaza un año inválido y una tabla vacía", () =>
    conApi(async (api) => {
      assert.equal((await api.put("/api/parametros/abc", { sbu: 500, tablaIr: TABLA_SIMPLE })).status, 400);
      assert.equal((await api.put("/api/parametros/2027", { sbu: 500, tablaIr: [] })).status, 400);
    }));
});
