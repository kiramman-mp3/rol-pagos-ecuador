import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EMPLEADO, iniciar } from "./ayuda.ts";
import type { Cliente } from "./ayuda.ts";

async function conDemo(prueba: (api: Cliente) => Promise<void>) {
  const api = await iniciar();
  try {
    await api.post("/api/empleados/demo");
    await prueba(api);
  } finally {
    api.cerrar();
  }
}

const generar = (api: Cliente, novedades: object[] = []) =>
  api.post("/api/roles/generar", { anio: 2026, mes: 10, novedades });

const detalleDe = async (api: Cliente, id: number, empleadoId: number) =>
  (await api.get(`/api/roles/${id}`)).json.detalle.find((d: { empleadoId: number }) => d.empleadoId === empleadoId);

// Empleados de ejemplo: 1 y 2 y 4 = Código del Trabajo, 3 = LOSEP, 5 = LOEP servidor, 6 = LOEP obrero.

describe("API de regímenes", () => {
  it("publica los tres regímenes con sus reglas", async () => {
    const api = await iniciar();
    try {
      const lista = (await api.get("/api/regimenes")).json;
      assert.deepEqual(lista.map((r: { codigo: string }) => r.codigo).sort(), ["CODIGO_TRABAJO", "LOEP", "LOSEP"]);
      const ct = lista.find((r: { codigo: string }) => r.codigo === "CODIGO_TRABAJO");
      assert.equal(ct.iessPersonal, 0.0945);
      assert.equal(ct.recargoSuplementarias, 0.5);
      assert.equal(ct.diasVacaciones, 15);
      const losep = lista.find((r: { codigo: string }) => r.codigo === "LOSEP");
      assert.equal(losep.iessPersonal, 0.1145);
      assert.equal(losep.recargoSuplementarias, 0.25);
      assert.equal(losep.recargoExtraordinarias, 0.6);
      assert.equal(losep.topeSuplementariasMes, 60);
      assert.equal(losep.diasVacaciones, 30);
      assert.equal(losep.verificado, false);
      const loep = lista.find((r: { codigo: string }) => r.codigo === "LOEP");
      assert.equal(loep.tipo, "mixto");
      assert.equal(loep.regimenServidor, "LOSEP");
      assert.equal(loep.regimenObrero, "CODIGO_TRABAJO");
      assert.equal((await api.get("/api/regimenes/NO_EXISTE")).status, 404);
    } finally {
      api.cerrar();
    }
  });

  it("también viajan en /api/parametros para que la pantalla no pida dos veces", async () => {
    const api = await iniciar();
    try {
      const p = (await api.get("/api/parametros")).json;
      assert.equal(p.regimenes.length, 3);
      assert.deepEqual(p.categoriasLoep, ["servidor", "obrero"]);
      assert.equal(p.iessPersonal, 0.0945);
    } finally {
      api.cerrar();
    }
  });

  it("edita un régimen y el cambio llega al cálculo del rol", () =>
    conDemo(async (api) => {
      const ct = (await api.get("/api/regimenes/CODIGO_TRABAJO")).json;
      const r = await api.put("/api/regimenes/CODIGO_TRABAJO", { ...ct, iessPersonal: 0.1 });
      assert.equal(r.status, 200);
      assert.equal(r.json.iessPersonal, 0.1);
      const { id } = (await generar(api)).json;
      const maria = await detalleDe(api, id, 1); // $4500 -> 10%
      assert.equal(maria.aporteIess, 450);
      assert.equal(maria.tasaIessPersonal, 0.1);
    }));

  it("rechaza valores fuera de rango y los reporta todos juntos", async () => {
    const api = await iniciar();
    try {
      const ct = (await api.get("/api/regimenes/CODIGO_TRABAJO")).json;
      const r = await api.put("/api/regimenes/CODIGO_TRABAJO", {
        ...ct, iessPersonal: 9.45, recargoNocturno: -1, diasVacaciones: 1.5, nombre: "",
      });
      assert.equal(r.status, 400);
      assert.ok(r.json.errores.length >= 4);
      assert.equal((await api.get("/api/regimenes/CODIGO_TRABAJO")).json.iessPersonal, 0.0945);
    } finally {
      api.cerrar();
    }
  });

  it("un tope vacío significa sin tope mensual", async () => {
    const api = await iniciar();
    try {
      const ct = (await api.get("/api/regimenes/CODIGO_TRABAJO")).json;
      const r = await api.put("/api/regimenes/CODIGO_TRABAJO", { ...ct, topeSuplementariasMes: "" });
      assert.equal(r.json.topeSuplementariasMes, null);
    } finally {
      api.cerrar();
    }
  });

  it("la LOEP solo puede remitir a regímenes con reglas propias", async () => {
    const api = await iniciar();
    try {
      const loep = (await api.get("/api/regimenes/LOEP")).json;
      const mal = await api.put("/api/regimenes/LOEP", { ...loep, regimenServidor: "LOEP" });
      assert.equal(mal.status, 400);
      const bien = await api.put("/api/regimenes/LOEP", { ...loep, regimenObrero: "LOSEP" });
      assert.equal(bien.json.regimenObrero, "LOSEP");
    } finally {
      api.cerrar();
    }
  });
});

describe("empleados y régimen", () => {
  it("guarda el régimen y por defecto usa el Código del Trabajo", async () => {
    const api = await iniciar();
    try {
      const por_defecto = await api.post("/api/empleados", EMPLEADO);
      assert.equal(por_defecto.json.regimen, "CODIGO_TRABAJO");
      assert.equal(por_defecto.json.categoriaLoep, null);
      const losep = await api.post("/api/empleados", { ...EMPLEADO, cedula: "1702345677", regimen: "LOSEP" });
      assert.equal(losep.json.regimen, "LOSEP");
    } finally {
      api.cerrar();
    }
  });

  it("la LOEP exige la categoría y las demás la ignoran", async () => {
    const api = await iniciar();
    try {
      const sin = await api.post("/api/empleados", { ...EMPLEADO, regimen: "LOEP" });
      assert.equal(sin.status, 400);
      assert.match(sin.json.errores[0], /servidor u obrero/);
      const con = await api.post("/api/empleados", { ...EMPLEADO, regimen: "LOEP", categoriaLoep: "obrero" });
      assert.equal(con.json.categoriaLoep, "obrero");
      const ignorada = await api.post("/api/empleados", {
        ...EMPLEADO, cedula: "1702345677", regimen: "LOSEP", categoriaLoep: "obrero",
      });
      assert.equal(ignorada.json.categoriaLoep, null);
    } finally {
      api.cerrar();
    }
  });

  it("rechaza un régimen que no existe", async () => {
    const api = await iniciar();
    try {
      const r = await api.post("/api/empleados", { ...EMPLEADO, regimen: "INVENTADO" });
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /régimen/);
    } finally {
      api.cerrar();
    }
  });

  it("los datos de ejemplo muestran los tres regímenes", () =>
    conDemo(async (api) => {
      const lista = (await api.get("/api/empleados")).json;
      const de = (nombre: string) => lista.find((e: { nombres: string }) => e.nombres.startsWith(nombre));
      assert.equal(de("Lucía").regimen, "LOSEP");
      assert.equal(de("Daniela").categoriaLoep, "servidor");
      assert.equal(de("Pedro").categoriaLoep, "obrero");
    }));
});

describe("roles según el régimen", () => {
  it("LOSEP: aporte IESS de 11.45%, patronal de 9.15% y 30 días de vacaciones", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const lucia = await detalleDe(api, id, 3); // $675
      assert.equal(lucia.regimen, "LOSEP");
      assert.equal(lucia.regimenAplicado, "LOSEP");
      assert.equal(lucia.aporteIess, 77.29); // 675 * 11.45% = 77.2875
      assert.equal(lucia.aportePatronal, 61.76); // 675 * 9.15% = 61.7625
      assert.equal(lucia.vacaciones, 56.25); // 675 * 30 / 360
      assert.equal(lucia.tasaIessPersonal, 0.1145);
    }));

  it("LOEP servidor sigue la LOSEP y LOEP obrero el Código del Trabajo", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const servidora = await detalleDe(api, id, 5); // Daniela, $2600
      assert.equal(servidora.regimen, "LOEP");
      assert.equal(servidora.regimenAplicado, "LOSEP");
      assert.equal(servidora.aporteIess, 297.7); // 2600 * 11.45%

      const obrero = await detalleDe(api, id, 6); // Pedro, $482, ingresó el 16 de octubre
      assert.equal(obrero.regimen, "LOEP");
      assert.equal(obrero.regimenAplicado, "CODIGO_TRABAJO");
      assert.equal(obrero.sueldo, 241); // 15 días
      assert.equal(obrero.aporteIess, 22.77); // 241 * 9.45% = 22.7745
    }));

  it("las horas se pagan con el recargo de cada régimen", () =>
    conDemo(async (api) => {
      // Lucía (LOSEP, $675, valor hora 2.8125): 10 h suplementarias al 25% = 35.16
      // Carlos (Código, $1800, valor hora 7.5): 10 h suplementarias al 50% = 112.50
      const { id } = (await generar(api, [
        { empleadoId: 3, horasSuplementarias: 10, horasExtraordinarias: 10 },
        { empleadoId: 2, horasSuplementarias: 10 },
      ])).json;
      const lucia = await detalleDe(api, id, 3);
      assert.equal(lucia.valorHorasSuplementarias, 35.16);
      assert.equal(lucia.valorHorasExtraordinarias, 45); // 10 * 2.8125 * 1.6 = 45.00
      const carlos = await detalleDe(api, id, 2);
      assert.equal(carlos.valorHorasSuplementarias, 112.5);
    }));

  it("el tope mensual depende del régimen", () =>
    conDemo(async (api) => {
      // 55 horas: dentro del tope de la LOSEP (60) pero sobre el del Código del Trabajo (48)
      const losep = await generar(api, [{ empleadoId: 3, horasSuplementarias: 55 }]);
      assert.deepEqual(losep.json.avisos, []);
      const ct = await generar(api, [{ empleadoId: 2, horasSuplementarias: 55 }]);
      assert.equal(ct.json.avisos.length, 1);
      const sobre = await generar(api, [{ empleadoId: 3, horasSuplementarias: 61 }]);
      assert.match(sobre.json.avisos[0], /Lucía.*60/);
    }));

  it("editar un régimen después no cambia los roles ya generados", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const antes = await detalleDe(api, id, 3);
      const losep = (await api.get("/api/regimenes/LOSEP")).json;
      await api.put("/api/regimenes/LOSEP", { ...losep, iessPersonal: 0.05 });
      const despues = await detalleDe(api, id, 3);
      assert.equal(despues.aporteIess, antes.aporteIess);
      assert.equal(despues.tasaIessPersonal, 0.1145);
    }));

  it("el período muestra qué régimen se aplicará a cada empleado", () =>
    conDemo(async (api) => {
      const empleados = (await api.get("/api/roles/periodo/2026/10")).json.empleados;
      const de = (id: number) => empleados.find((e: { id: number }) => e.id === id);
      assert.equal(de(5).regimen, "LOEP");
      assert.equal(de(5).regimenAplicado, "LOSEP");
      assert.equal(de(6).regimenAplicado, "CODIGO_TRABAJO");
    }));

  it("el CSV incluye el régimen aplicado", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const csv = (await api.get(`/api/roles/${id}/csv`)).texto;
      assert.ok(csv.includes("regimen_aplicado"));
      assert.ok(csv.includes("LOSEP"));
    }));
});

describe("simulación según el régimen", () => {
  it("calcula con las reglas del régimen elegido", async () => {
    const api = await iniciar();
    try {
      const ct = (await api.post("/api/simulacion", { sueldo: 2000 })).json;
      assert.equal(ct.aporteIess, 189);
      assert.equal(ct.regimenAplicado, "Código del Trabajo");
      const losep = (await api.post("/api/simulacion", { sueldo: 2000, regimen: "LOSEP" })).json;
      assert.equal(losep.aporteIess, 229);
      assert.equal(losep.tasaIessPersonal, 0.1145);
      const obrero = (await api.post("/api/simulacion", { sueldo: 2000, regimen: "LOEP", categoriaLoep: "obrero" })).json;
      assert.equal(obrero.aporteIess, 189);
    } finally {
      api.cerrar();
    }
  });

  it("rechaza un régimen inexistente o una LOEP sin categoría", async () => {
    const api = await iniciar();
    try {
      assert.equal((await api.post("/api/simulacion", { sueldo: 2000, regimen: "X" })).status, 400);
      assert.equal((await api.post("/api/simulacion", { sueldo: 2000, regimen: "LOEP" })).status, 400);
    } finally {
      api.cerrar();
    }
  });
});
