import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPLEADO, iniciar } from "./ayuda.ts";
import type { Cliente } from "./ayuda.ts";

async function conApi(prueba: (api: Cliente) => Promise<void>) {
  const api = await iniciar();
  try {
    await prueba(api);
  } finally {
    api.cerrar();
  }
}

const gradoDe = async (api: Cliente, grado: number, regimen = "LOSEP") =>
  (await api.get(`/api/escala?regimen=${regimen}`)).json.find((g: { grado: number }) => g.grado === grado);

describe("API de escala salarial", () => {
  it("trae la escala de ejemplo de la LOSEP con 22 grados", () =>
    conApi(async (api) => {
      const escala = (await api.get("/api/escala")).json;
      assert.equal(escala.length, 22);
      assert.equal(escala[0].grado, 1);
      assert.equal(escala[0].rmu, 527);
      assert.equal(escala[21].rmu, 4500);
      assert.ok(escala.every((g: { fuente: string }) => g.fuente.includes("por confirmar")));
    }));

  it("filtra por régimen", () =>
    conApi(async (api) => {
      assert.equal((await api.get("/api/escala?regimen=LOSEP")).json.length, 22);
      assert.equal((await api.get("/api/escala?regimen=CODIGO_TRABAJO")).json.length, 0);
    }));

  it("crea, edita y elimina un grado", () =>
    conApi(async (api) => {
      const creado = await api.post("/api/escala", {
        regimen: "CODIGO_TRABAJO", grado: 1, denominacion: "Operario", rmu: 500, fuente: "Prueba",
      });
      assert.equal(creado.status, 201);
      const id = creado.json.id;

      const editado = await api.put(`/api/escala/${id}`, {
        regimen: "CODIGO_TRABAJO", grado: 1, denominacion: "Operario calificado", rmu: 520,
      });
      assert.equal(editado.json.denominacion, "Operario calificado");
      assert.equal(editado.json.rmu, 520);

      assert.equal((await api.del(`/api/escala/${id}`)).status, 204);
      assert.equal((await api.get(`/api/escala/${id}`)).status, 404);
    }));

  it("rechaza grados repetidos con 409 y datos inválidos con todos los motivos", () =>
    conApi(async (api) => {
      const repetido = await api.post("/api/escala", { regimen: "LOSEP", grado: 1, denominacion: "X", rmu: 600 });
      assert.equal(repetido.status, 409);

      const mal = await api.post("/api/escala", { regimen: "LOEP", grado: 0, denominacion: "", rmu: -5 });
      assert.equal(mal.status, 400);
      assert.ok(mal.json.errores.length >= 4);
      assert.equal((await api.put("/api/escala/9999", { regimen: "LOSEP", grado: 1, denominacion: "X", rmu: 1 })).status, 404);
      assert.equal((await api.del("/api/escala/9999")).status, 404);
    }));
});

describe("empleados y escala salarial", () => {
  it("vincula un empleado a un grado de su régimen sin avisos si el sueldo coincide", () =>
    conApi(async (api) => {
      const g5 = await gradoDe(api, 5);
      const r = await api.post("/api/empleados", {
        ...EMPLEADO, regimen: "LOSEP", sueldoBase: g5.rmu, escalaId: g5.id,
      });
      assert.equal(r.status, 201);
      assert.equal(r.json.escalaId, g5.id);
      assert.deepEqual(r.json.avisos, []);
    }));

  it("rechaza un sueldo distinto de la RMU del grado", () =>
    conApi(async (api) => {
      const g5 = await gradoDe(api, 5);
      const r = await api.post("/api/empleados", {
        ...EMPLEADO, regimen: "LOSEP", sueldoBase: 700, escalaId: g5.id,
      });
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /debe ser la RMU del grado 5 \(\$675\)/);
    }));

  it("un grado de otra escala se rechaza", () =>
    conApi(async (api) => {
      const g5 = await gradoDe(api, 5);
      const r = await api.post("/api/empleados", { ...EMPLEADO, regimen: "CODIGO_TRABAJO", escalaId: g5.id });
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /escala LOSEP, no de CODIGO_TRABAJO/);
      assert.equal((await api.post("/api/empleados", { ...EMPLEADO, regimen: "LOSEP", escalaId: 9999 })).status, 400);
    }));

  it("un servidor de la LOEP usa la escala de la LOSEP; un obrero no", () =>
    conApi(async (api) => {
      const g7 = await gradoDe(api, 7);
      const servidor = await api.post("/api/empleados", {
        ...EMPLEADO, regimen: "LOEP", categoriaLoep: "servidor", sueldoBase: g7.rmu, escalaId: g7.id,
      });
      assert.equal(servidor.status, 201);
      const obrero = await api.post("/api/empleados", {
        ...EMPLEADO, cedula: "1702345677", regimen: "LOEP", categoriaLoep: "obrero", escalaId: g7.id,
      });
      assert.equal(obrero.status, 400);
    }));

  it("un régimen con escala exige elegir un grado", () =>
    conApi(async (api) => {
      const r = await api.post("/api/empleados", { ...EMPLEADO, regimen: "LOSEP", escalaId: null });
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /Elige un grado de la escala salarial LOSEP/);
    }));

  it("un régimen sin escala no pide grado y deja el sueldo libre", () =>
    conApi(async (api) => {
      const r = await api.post("/api/empleados", { ...EMPLEADO, regimen: "CODIGO_TRABAJO", escalaId: null });
      assert.equal(r.status, 201);
      assert.equal(r.json.escalaId, null);
    }));

  it("al borrar un grado, el empleado conserva su sueldo y pierde el vínculo", () =>
    conApi(async (api) => {
      const g5 = await gradoDe(api, 5);
      const { json: ana } = await api.post("/api/empleados", {
        ...EMPLEADO, regimen: "LOSEP", sueldoBase: g5.rmu, escalaId: g5.id,
      });
      await api.del(`/api/escala/${g5.id}`);
      const despues = (await api.get(`/api/empleados/${ana.id}`)).json;
      assert.equal(despues.escalaId, null);
      assert.equal(despues.sueldoBase, g5.rmu);
    }));

  it("en los datos de ejemplo, quien es servidor tiene su grado de la escala", () =>
    conApi(async (api) => {
      await api.post("/api/empleados/demo");
      const lucia = (await api.get("/api/empleados")).json.find((e: { nombres: string }) => e.nombres.startsWith("Lucía"));
      const g5 = await gradoDe(api, 5);
      assert.equal(lucia.escalaId, g5.id);
      assert.equal(lucia.sueldoBase, 675);
    }));
});
