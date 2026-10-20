import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPLEADO, iniciar, NIVEL_E2_CT, PUESTO_AUXILIAR } from "./ayuda.ts";
import type { Cliente } from "./ayuda.ts";

async function conApi(prueba: (api: Cliente) => Promise<void>) {
  const api = await iniciar();
  try {
    await prueba(api);
  } finally {
    api.cerrar();
  }
}

const NUEVO = {
  nombre: "Técnico de soporte", superiorId: 2, funcion: "Atender los reclamos de los clientes.",
  responsabilidad: "Responde por resolver cada reclamo a tiempo.", sector: "Servicios", escalaId: NIVEL_E2_CT,
};

describe("orgánico funcional", () => {
  it("trae el orgánico de ejemplo: gerente, administrador y tres puestos bajo el administrador", () =>
    conApi(async (api) => {
      const puestos = (await api.get("/api/puestos")).json;
      assert.deepEqual(
        puestos.map((p: { nombre: string; superiorId: number | null }) => [p.nombre, p.superiorId]),
        [
          ["Gerente / Propietario", null],
          ["Administrador / Contador", 1],
          ["Supervisor de instalaciones", 2],
          ["Operaciones de instalaciones", 2],
          ["Auxiliar de guardalmacén", 2],
        ],
      );
    }));

  it("cada puesto trae función, responsabilidad, sector y su referencia salarial", () =>
    conApi(async (api) => {
      const puestos = (await api.get("/api/puestos")).json;
      for (const p of puestos) {
        assert.ok(p.funcion && p.responsabilidad && p.sector, p.nombre);
        assert.equal(p.referencia.regimen, "CODIGO_TRABAJO");
        assert.equal(p.referencia.esMinimo, true);
      }
      assert.equal(puestos[0].referencia.denominacion, "A: Jefatura");
      assert.equal(puestos[1].referencia.denominacion, "B1: Supervisión general");
      assert.equal(puestos[4].referencia.id, NIVEL_E2_CT);
    }));

  it("crea, edita y elimina un puesto", () =>
    conApi(async (api) => {
      const creado = await api.post("/api/puestos", NUEVO);
      assert.equal(creado.status, 201);
      assert.equal(creado.json.empleados, 0);
      const editado = await api.put(`/api/puestos/${creado.json.id}`, { ...NUEVO, sector: "Telecomunicaciones" });
      assert.equal(editado.json.sector, "Telecomunicaciones");
      assert.equal((await api.del(`/api/puestos/${creado.json.id}`)).status, 204);
      assert.equal((await api.get(`/api/puestos/${creado.json.id}`)).status, 404);
    }));

  it("rechaza nombre repetido con 409 y datos incompletos con todos los motivos", () =>
    conApi(async (api) => {
      assert.equal((await api.post("/api/puestos", { ...NUEVO, nombre: "Gerente / Propietario" })).status, 409);
      const mal = await api.post("/api/puestos", { superiorId: 999, escalaId: 9999 });
      assert.equal(mal.status, 400);
      assert.ok(mal.json.errores.length >= 5);
    }));

  it("exige la referencia salarial del puesto", () =>
    conApi(async (api) => {
      const r = await api.post("/api/puestos", { ...NUEVO, escalaId: null });
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /nivel de la escala salarial/);
    }));

  it("no deja que un puesto dependa de sí mismo ni de uno de sus subordinados", () =>
    conApi(async (api) => {
      const actual = (await api.get("/api/puestos/1")).json;
      const base = { nombre: actual.nombre, funcion: actual.funcion, responsabilidad: actual.responsabilidad, sector: actual.sector, escalaId: actual.escalaId };
      assert.equal((await api.put("/api/puestos/1", { ...base, superiorId: 1 })).status, 400);
      const ciclo = await api.put("/api/puestos/1", { ...base, superiorId: 3 }); // 3 depende de 2, que depende de 1
      assert.equal(ciclo.status, 400);
      assert.match(ciclo.json.errores[0], /no puede depender de sí mismo/);
    }));
});

describe("empleados y orgánico", () => {
  it("el puesto fija el nivel salarial: no hace falta mandar el grado", () =>
    conApi(async (api) => {
      const r = await api.post("/api/empleados", { ...EMPLEADO, puestoId: 3, escalaId: undefined, sueldoBase: 700 });
      assert.equal(r.status, 201);
      assert.equal(r.json.puestoId, 3);
      const supervisor = (await api.get("/api/puestos/3")).json;
      assert.equal(r.json.escalaId, supervisor.escalaId);
      assert.equal((await api.get("/api/puestos/3")).json.empleados, 1);
    }));

  it("deja elegir otro nivel de la misma escala, pero avisa que difiere del puesto", () =>
    conApi(async (api) => {
      const gerente = (await api.get("/api/puestos/1")).json;
      const r = await api.post("/api/empleados", { ...EMPLEADO, puestoId: PUESTO_AUXILIAR, escalaId: gerente.escalaId });
      assert.equal(r.status, 201);
      assert.equal(r.json.escalaId, gerente.escalaId);
      assert.match(r.json.avisos[0], /difiere de la referencia del puesto «Auxiliar de guardalmacén»/);
    }));

  it("el sueldo no puede ser menor al mínimo del nivel del puesto", () =>
    conApi(async (api) => {
      const r = await api.post("/api/empleados", { ...EMPLEADO, puestoId: 1, escalaId: undefined, sueldoBase: 482 });
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /no puede ser menor al mínimo del nivel A: Jefatura \(\$510\)/);
    }));

  it("un puesto que no existe o de otra escala se rechaza", () =>
    conApi(async (api) => {
      assert.equal((await api.post("/api/empleados", { ...EMPLEADO, puestoId: 999 })).status, 400);
      const losep = await api.post("/api/empleados", { ...EMPLEADO, regimen: "LOSEP", escalaId: null });
      assert.equal(losep.status, 400);
      assert.match(losep.json.errores.join(" "), /es de la escala CODIGO_TRABAJO, no de LOSEP/);
    }));

  it("al borrar un puesto, el empleado conserva su sueldo y pierde el vínculo", () =>
    conApi(async (api) => {
      const { json: ana } = await api.post("/api/empleados", EMPLEADO);
      await api.del(`/api/puestos/${PUESTO_AUXILIAR}`);
      const despues = (await api.get(`/api/empleados/${ana.id}`)).json;
      assert.equal(despues.puestoId, null);
      assert.equal(despues.sueldoBase, EMPLEADO.sueldoBase);
    }));

  it("en los datos de ejemplo, el personal del Código del Trabajo ocupa su puesto", () =>
    conApi(async (api) => {
      await api.post("/api/empleados/demo");
      const lista = (await api.get("/api/empleados")).json;
      const puestoDe = (nombre: string) => lista.find((e: { nombres: string }) => e.nombres.startsWith(nombre)).puestoId;
      assert.equal(puestoDe("María"), 1);
      assert.equal(puestoDe("Carlos"), 2);
      assert.equal(puestoDe("José"), 3);
      assert.equal(puestoDe("Pedro"), PUESTO_AUXILIAR);
      assert.equal(puestoDe("Lucía"), null); // LOSEP: sin puestos en el orgánico
    }));
});
