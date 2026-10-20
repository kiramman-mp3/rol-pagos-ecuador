import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { EMPLEADO, iniciar, NIVEL_E2_CT } from "./ayuda.ts";
import type { Cliente } from "./ayuda.ts";

describe("API de empleados", () => {
  let api: Cliente;
  before(async () => {
    api = await iniciar();
  });
  after(() => api.cerrar());

  it("crea, lista, edita, desactiva y elimina", async () => {
    const creado = await api.post("/api/empleados", EMPLEADO);
    assert.equal(creado.status, 201);
    assert.equal(creado.json.nombres, "Ana Prueba");
    assert.equal(creado.json.activo, true);
    const id = creado.json.id;

    assert.equal((await api.get("/api/empleados")).json.length, 1);

    const editado = await api.put(`/api/empleados/${id}`, { ...EMPLEADO, cargo: "Jefe de área" });
    assert.equal(editado.json.cargo, "Jefe de área");

    assert.equal((await api.patch(`/api/empleados/${id}/estado`)).json.activo, false);
    assert.equal((await api.del(`/api/empleados/${id}`)).status, 204);
    assert.equal((await api.get(`/api/empleados/${id}`)).status, 404);
  });

  it("rechaza cédula inválida y reporta todos los errores juntos", async () => {
    const r = await api.post("/api/empleados", {
      ...EMPLEADO, cedula: "1801234560", cargo: "", sueldoBase: "abc",
    });
    assert.equal(r.status, 400);
    assert.ok(r.json.errores.length >= 3);
  });

  it("rechaza cédula duplicada con 409", async () => {
    const otra = { ...EMPLEADO, cedula: "1702345677" };
    assert.equal((await api.post("/api/empleados", otra)).status, 201);
    const repetida = await api.post("/api/empleados", otra);
    assert.equal(repetida.status, 409);
    assert.match(repetida.json.errores[0], /Ya existe/);
  });

  it("no registra a un empleado con sueldo menor al SBU y lo dice", async () => {
    // el mínimo del nivel está por encima del SBU, así que se baja para llegar solo a esa regla
    const nivel = (await api.get(`/api/escala/${NIVEL_E2_CT}`)).json;
    await api.put(`/api/escala/${NIVEL_E2_CT}`, { ...nivel, rmu: 300 });
    const r = await api.post("/api/empleados", { ...EMPLEADO, cedula: "0903456788", sueldoBase: 400 });
    assert.equal(r.status, 400);
    assert.match(r.json.errores[0], /No se puede registrar al empleado: el sueldo \(\$400\) es menor al salario básico unificado/);
    assert.equal((await api.get("/api/empleados")).json.length, 1); // solo el del before: no se guardó
  });

  it("no registra a un empleado con sueldo menor al mínimo de su nivel y lo dice", async () => {
    const r = await api.post("/api/empleados", { ...EMPLEADO, cedula: "0903456788", puestoId: 1, escalaId: undefined, sueldoBase: 490 });
    assert.equal(r.status, 400);
    assert.match(r.json.errores[0], /No se puede registrar al empleado: el sueldo \(\$490\) es menor al mínimo del nivel A: Jefatura \(\$510\)/);
  });

  it("el SBU que se exige es el guardado en la base, no uno fijo", async () => {
    const propia = await iniciar();
    try {
      const tabla = (await propia.get("/api/parametros?anio=2026")).json.tablaIr;
      await propia.put("/api/parametros/2026", { sbu: 600, tablaIr: tabla });
      const r = await propia.post("/api/empleados", { ...EMPLEADO, sueldoBase: 550 });
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /\$600/);
      const bien = await propia.post("/api/empleados", { ...EMPLEADO, cedula: "1702345677", sueldoBase: 650 });
      assert.equal(bien.status, 201);
      assert.deepEqual(bien.json.avisos, []);
    } finally {
      propia.cerrar();
    }
  });

  it("carga los datos de ejemplo una sola vez", async () => {
    const limpia = await iniciar();
    try {
      assert.equal((await limpia.post("/api/empleados/demo")).json.agregados, 6);
      assert.equal((await limpia.post("/api/empleados/demo")).json.agregados, 0);
      assert.equal((await limpia.get("/api/empleados")).json.length, 6);
    } finally {
      limpia.cerrar();
    }
  });

  it("responde JSON y 404 para rutas de API inexistentes", async () => {
    const r = await api.get("/api/no-existe");
    assert.equal(r.status, 404);
    assert.deepEqual(r.json.errores, ["Ruta no encontrada."]);
  });
});
