import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { iniciar } from "./ayuda.ts";
import type { Cliente } from "./ayuda.ts";

/** Cada prueba usa su propia API con los 6 empleados de ejemplo. */
async function conDemo(prueba: (api: Cliente) => Promise<void>) {
  const api = await iniciar();
  try {
    await api.post("/api/empleados/demo");
    await prueba(api);
  } finally {
    api.cerrar();
  }
}

const generar = (api: Cliente, novedades: object[] = [], anio = 2026, mes = 10) =>
  api.post("/api/roles/generar", { anio, mes, novedades });

describe("API de roles", () => {
  it("procesa a todos los activos y omite a los inactivos", () =>
    conDemo(async (api) => {
      await api.patch("/api/empleados/2/estado");
      const r = await generar(api);
      assert.equal(r.status, 201);
      assert.equal(r.json.empleados, 5);
      assert.equal((await api.get(`/api/roles/${r.json.id}`)).json.numEmpleados, 5);
    }));

  it("los totales de la cabecera cuadran con el detalle", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const rol = (await api.get(`/api/roles/${id}`)).json;
      const suma = (campo: string) =>
        Number(rol.detalle.reduce((s: number, d: Record<string, number>) => s + d[campo], 0).toFixed(2));
      assert.equal(suma("netoPagar"), rol.totalNeto);
      assert.equal(suma("totalIngresos"), rol.totalIngresos);
      for (const d of rol.detalle) {
        assert.equal(Number((d.totalIngresos - d.totalDescuentos).toFixed(2)), d.netoPagar);
        assert.equal(Number((d.totalIngresos + d.totalProvisiones).toFixed(2)), d.costoEmpleador);
      }
    }));

  it("aplica las novedades y las recuerda para el mismo período", () =>
    conDemo(async (api) => {
      // empleado 2 (Carlos, $1800): 10 h al 50% -> valor hora 7.5 -> 112.50
      const novedades = [{ empleadoId: 2, horasSuplementarias: 10, comisiones: 200, otrosDescuentos: 30 }];
      const { id } = (await generar(api, novedades)).json;
      const d = (await api.get(`/api/roles/${id}`)).json.detalle.find(
        (x: { empleadoId: number }) => x.empleadoId === 2,
      );
      assert.equal(d.valorHorasSuplementarias, 112.5);
      assert.equal(d.ingresosAportables, 2112.5); // sueldo + horas + comisiones
      assert.equal(d.otrosDescuentos, 30);

      const periodo = (await api.get("/api/roles/periodo/2026/10")).json;
      assert.equal(periodo.existe, true);
      const carlos = periodo.empleados.find((e: { id: number }) => e.id === 2);
      assert.equal(carlos.novedades.comisiones, 200);
      assert.equal(carlos.novedades.horasDescanso, 0);
    }));

  it("avisa, sin bloquear, cuando las horas pasan el tope del régimen", () =>
    conDemo(async (api) => {
      // Carlos (Código del Trabajo): el tope de referencia es 48 suplementarias al mes.
      const r = await generar(api, [{ empleadoId: 2, horasSuplementarias: 60 }]);
      assert.equal(r.status, 201);
      assert.equal(r.json.avisos.length, 1);
      assert.match(r.json.avisos[0], /Carlos.*suplementarias.*48/);
      assert.deepEqual((await generar(api, [{ empleadoId: 2, horasSuplementarias: 10 }])).json.avisos, []);
    }));

  it("las horas extraordinarias se pagan y se recuerdan por separado", () =>
    conDemo(async (api) => {
      // Carlos, $1800: valor hora 7.5; 4 h extraordinarias al 100% = 60
      const { id } = (await generar(api, [{ empleadoId: 2, horasExtraordinarias: 4 }])).json;
      const d = (await api.get(`/api/roles/${id}`)).json.detalle.find(
        (x: { empleadoId: number }) => x.empleadoId === 2,
      );
      assert.equal(d.valorHorasExtraordinarias, 60);
      assert.equal(d.valorHorasSuplementarias, 0);
      const carlos = (await api.get("/api/roles/periodo/2026/10")).json.empleados.find(
        (e: { id: number }) => e.id === 2,
      );
      assert.equal(carlos.novedades.horasExtraordinarias, 4);
    }));

  it("volver a generar reemplaza el rol del mes", () =>
    conDemo(async (api) => {
      await generar(api);
      await generar(api, [{ empleadoId: 1, comisiones: 500 }]);
      const lista = (await api.get("/api/roles")).json;
      assert.equal(lista.length, 1);
      assert.equal((await api.get(`/api/roles/${lista[0].id}`)).json.detalle.length, 6);
    }));

  it("un empleado con ingreso posterior al mes no entra", () =>
    conDemo(async (api) => {
      const r = await generar(api, [], 2026, 9); // Pedro ingresa el 2026-10-16
      assert.equal(r.json.empleados, 5);
    }));

  it("el historial sobrevive a eliminar al empleado", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      await api.del("/api/empleados/1");
      const detalle = (await api.get(`/api/roles/${id}`)).json.detalle;
      const maria = detalle.find((d: { nombres: string }) => d.nombres.startsWith("María"));
      assert.ok(maria);
      assert.equal(maria.empleadoId, 1);
    }));

  it("una novedad inválida no genera nada", () =>
    conDemo(async (api) => {
      const r = await generar(api, [{ empleadoId: 1, horasSuplementarias: "abc" }]);
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /María/);
      assert.equal((await api.get("/api/roles")).json.length, 0);
    }));

  it("exporta CSV, devuelve 404 y elimina en cascada", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const csv = await api.get(`/api/roles/${id}/csv`);
      assert.match(csv.tipo, /text\/csv/);
      assert.ok(csv.texto.includes("neto_pagar"));
      assert.equal(csv.texto.trim().split("\n").length, 7); // encabezado + 6 empleados
      assert.equal((await api.get("/api/roles/99")).status, 404);
      assert.equal((await api.del(`/api/roles/${id}`)).status, 204);
      assert.equal((await api.get(`/api/roles/${id}`)).status, 404);
    }));

  it("rechaza períodos inválidos", () =>
    conDemo(async (api) => {
      assert.equal((await api.get("/api/roles/periodo/1900/13")).status, 400);
      assert.equal((await generar(api, [], 2026, 13)).status, 400);
    }));

  it("no genera si no hay empleados activos", async () => {
    const api = await iniciar();
    try {
      const r = await generar(api);
      assert.equal(r.status, 400);
      assert.match(r.json.errores[0], /No hay empleados activos/);
    } finally {
      api.cerrar();
    }
  });
});

describe("API de parámetros y simulación", () => {
  it("publica las reglas de ley 2026", async () => {
    const api = await iniciar();
    try {
      const p = (await api.get("/api/parametros")).json;
      assert.equal(p.sbu, 482);
      assert.equal(p.iessPersonal, 0.0945);
      assert.equal(p.fraccionExentaIr, 12208);
      assert.equal(p.tablaIr.length, 10);
    } finally {
      api.cerrar();
    }
  });

  it("simula un rol sin guardar nada", async () => {
    const api = await iniciar();
    try {
      // Por defecto los décimos y el fondo de reserva se pagan en el rol.
      const r = await api.post("/api/simulacion", { sueldo: 2000 });
      assert.equal(r.status, 200);
      assert.equal(r.json.netoPagar, 2116.42);
      assert.equal(r.json.impuestoRenta, 68.02);
      assert.equal(r.json.decimoTerceroModalidad, "mensual");
      // Si el trabajador los acumula, el neto es el del sueldo.
      const acumulado = await api.post("/api/simulacion", { sueldo: 2000, decimos: "acumulado" });
      assert.equal(acumulado.json.netoPagar, 1742.98);
      assert.equal((await api.get("/api/roles")).json.length, 0);
    } finally {
      api.cerrar();
    }
  });

  it("valida los límites de la simulación", async () => {
    const api = await iniciar();
    try {
      assert.equal((await api.post("/api/simulacion", { sueldo: -5 })).status, 400);
      assert.equal((await api.post("/api/simulacion", { sueldo: 2000, horasSuplementarias: 500 })).status, 400);
      assert.equal((await api.post("/api/simulacion", {})).status, 400);
    } finally {
      api.cerrar();
    }
  });
});
