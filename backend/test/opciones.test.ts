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

const generar = (api: Cliente, novedades: object[] = [], mes = 10) =>
  api.post("/api/roles/generar", { anio: 2026, mes, novedades });

const detalleDe = async (api: Cliente, id: number, empleadoId: number) =>
  (await api.get(`/api/roles/${id}`)).json.detalle.find((d: { empleadoId: number }) => d.empleadoId === empleadoId);

const empleadoCompleto = async (api: Cliente, id: number) => {
  const { json: e } = await api.get(`/api/empleados/${id}`);
  const { id: _id, activo: _activo, avisos: _avisos, ...datos } = e;
  return datos;
};

// Carlos (id 2): Código del Trabajo, $1800, ingresó en 2022. Aportable 1800:
//   décimo tercero 150.00, décimo cuarto 40.17, fondos de reserva 149.94.

describe("por defecto, los beneficios se pagan cada mes en el rol", () => {
  it("el décimo tercero, el cuarto y los fondos suben el ingreso pero no la base del IESS", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const carlos = await detalleDe(api, id, 2);
      assert.equal(carlos.decimoTerceroModalidad, "mensual");
      assert.equal(carlos.decimoTercero, 150);
      assert.equal(carlos.decimoCuarto, 40.17);
      assert.equal(carlos.fondosReserva, 149.94);
      assert.equal(carlos.ingresosAportables, 1800);
      assert.equal(carlos.beneficiosMensuales, 340.11);
      assert.equal(carlos.totalIngresos, 2140.11);
      assert.equal(carlos.aporteIess, 170.1); // 9.45% de 1800
      assert.equal(carlos.netoPagar, Number((2140.11 - carlos.totalDescuentos).toFixed(2)));
    }));

  it("lo pagado en el rol ya no se provisiona", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const carlos = await detalleDe(api, id, 2);
      // vacaciones 1800/24 = 75 + aporte patronal 11.15% = 200.70
      assert.equal(carlos.totalProvisiones, 275.7);
      assert.equal(carlos.costoEmpleador, Number((2140.11 + 275.7).toFixed(2)));
    }));

  it("el fondo de reserva no se paga antes de los 12 meses de servicio", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const jose = await detalleDe(api, id, 4); // ingresó en noviembre de 2025: 11 meses
      assert.equal(jose.fondosReserva, 0);
      assert.equal(jose.fondosReservaModalidad, "mensual");
    }));

  it("los totales de la cabecera siguen cuadrando", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const rol = (await api.get(`/api/roles/${id}`)).json;
      const suma = (campo: string) =>
        Number(rol.detalle.reduce((s: number, d: Record<string, number>) => s + d[campo], 0).toFixed(2));
      assert.equal(suma("totalIngresos"), rol.totalIngresos);
      assert.equal(suma("netoPagar"), rol.totalNeto);
      assert.equal(suma("costoEmpleador"), rol.totalCosto);
      for (const d of rol.detalle) {
        assert.equal(Number((d.totalIngresos - d.totalDescuentos).toFixed(2)), d.netoPagar);
        assert.equal(Number((d.ingresosAportables + d.beneficiosMensuales).toFixed(2)), d.totalIngresos);
      }
    }));
});

describe("opciones por empleado", () => {
  it("un empleado que acumula el décimo tercero lo provisiona en vez de pagarlo", () =>
    conDemo(async (api) => {
      await api.put("/api/empleados/2", { ...(await empleadoCompleto(api, 2)), pagoDecimoTercero: "acumulado" });
      const { id } = (await generar(api)).json;
      const carlos = await detalleDe(api, id, 2);
      assert.equal(carlos.decimoTerceroModalidad, "acumulado");
      assert.equal(carlos.decimoTercero, 150);
      assert.equal(carlos.beneficiosMensuales, 190.11); // 40.17 + 149.94
      assert.equal(carlos.totalProvisiones, 425.7); // 150 + 75 + 200.70
    }));

  it("un empleado que no recibe un beneficio no lo cobra ni se provisiona", () =>
    conDemo(async (api) => {
      await api.put("/api/empleados/2", {
        ...(await empleadoCompleto(api, 2)), pagoDecimoCuarto: "no", pagoFondosReserva: "no",
      });
      const { id } = (await generar(api)).json;
      const carlos = await detalleDe(api, id, 2);
      assert.equal(carlos.decimoCuarto, 0);
      assert.equal(carlos.fondosReserva, 0);
      assert.equal(carlos.decimoCuartoModalidad, "no");
      assert.equal(carlos.totalIngresos, 1950); // 1800 + décimo tercero
    }));

  it("quien no recibe horas extras no las cobra y se avisa", () =>
    conDemo(async (api) => {
      await api.put("/api/empleados/2", { ...(await empleadoCompleto(api, 2)), recibeHorasExtras: false });
      const r = await generar(api, [{ empleadoId: 2, horasSuplementarias: 10, horasNocturnas: 8 }]);
      assert.equal(r.status, 201);
      assert.match(r.json.avisos[0], /Carlos.*no recibe horas extras.*10 horas/);
      const carlos = await detalleDe(api, r.json.id, 2);
      assert.equal(carlos.valorHorasSuplementarias, 0);
      assert.equal(carlos.horasSuplementarias, 0);
      assert.equal(carlos.valorRecargoNocturno, 15); // 8 * 7.5 * 0.25: el recargo nocturno no es hora extra
    }));

  it("el período indica a quién se le deshabilitan las horas extras", () =>
    conDemo(async (api) => {
      await api.put("/api/empleados/2", { ...(await empleadoCompleto(api, 2)), recibeHorasExtras: false });
      const empleados = (await api.get("/api/roles/periodo/2026/10")).json.empleados;
      assert.equal(empleados.find((e: { id: number }) => e.id === 2).recibeHorasExtras, false);
      assert.equal(empleados.find((e: { id: number }) => e.id === 1).recibeHorasExtras, true);
    }));

  it("un régimen que no concede un beneficio lo deja en 'no' salvo que el empleado lo pida", () =>
    conDemo(async (api) => {
      const losep = (await api.get("/api/regimenes/LOSEP")).json;
      await api.put("/api/regimenes/LOSEP", { ...losep, aplicaDecimoCuarto: false, aplicaHorasExtras: false });
      let { id } = (await generar(api, [{ empleadoId: 3, horasSuplementarias: 5 }])).json;
      let lucia = await detalleDe(api, id, 3);
      assert.equal(lucia.decimoCuartoModalidad, "no");
      assert.equal(lucia.valorHorasSuplementarias, 0);
      assert.equal(lucia.decimoTerceroModalidad, "mensual");

      await api.put("/api/empleados/3", {
        ...(await empleadoCompleto(api, 3)), pagoDecimoCuarto: "mensual", recibeHorasExtras: true,
      });
      id = (await generar(api, [{ empleadoId: 3, horasSuplementarias: 5 }])).json.id;
      lucia = await detalleDe(api, id, 3);
      assert.equal(lucia.decimoCuartoModalidad, "mensual");
      assert.ok(lucia.valorHorasSuplementarias > 0);
    }));

  it("se guardan y se devuelven; vacío significa lo que diga el régimen", async () => {
    const api = await iniciar();
    try {
      const sin = (await api.post("/api/empleados", EMPLEADO)).json;
      assert.equal(sin.pagoDecimoTercero, null);
      assert.equal(sin.recibeHorasExtras, null);

      const con = (await api.post("/api/empleados", {
        ...EMPLEADO, cedula: "1702345677", pagoDecimoTercero: "acumulado", pagoDecimoCuarto: "no",
        pagoFondosReserva: "mensual", recibeHorasExtras: false,
      })).json;
      assert.equal(con.pagoDecimoTercero, "acumulado");
      assert.equal(con.pagoDecimoCuarto, "no");
      assert.equal(con.pagoFondosReserva, "mensual");
      assert.equal(con.recibeHorasExtras, false);

      const vaciado = (await api.put(`/api/empleados/${con.id}`, {
        ...EMPLEADO, cedula: "1702345677", pagoDecimoTercero: "", recibeHorasExtras: null,
      })).json;
      assert.equal(vaciado.pagoDecimoTercero, null);
      assert.equal(vaciado.recibeHorasExtras, null);
    } finally {
      api.cerrar();
    }
  });

  it("rechaza una modalidad inválida", async () => {
    const api = await iniciar();
    try {
      const r = await api.post("/api/empleados", { ...EMPLEADO, pagoDecimoTercero: "quizás", recibeHorasExtras: "si" });
      assert.equal(r.status, 400);
      assert.equal(r.json.errores.length, 2);
    } finally {
      api.cerrar();
    }
  });

  it("el historial recuerda la modalidad aunque luego cambie la opción del empleado", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      await api.put("/api/empleados/2", { ...(await empleadoCompleto(api, 2)), pagoDecimoTercero: "acumulado" });
      assert.equal((await detalleDe(api, id, 2)).decimoTerceroModalidad, "mensual");
    }));

  it("el CSV trae la modalidad de cada beneficio", () =>
    conDemo(async (api) => {
      const { id } = (await generar(api)).json;
      const csv = (await api.get(`/api/roles/${id}/csv`)).texto;
      assert.ok(csv.includes("decimo_tercero_modalidad"));
      assert.ok(csv.includes("beneficios_mensuales"));
      assert.ok(csv.includes("mensual"));
    }));
});

describe("simulación con modalidad", () => {
  it("aplica la misma modalidad a los tres beneficios y la valida", async () => {
    const api = await iniciar();
    try {
      const no = (await api.post("/api/simulacion", { sueldo: 2000, decimos: "no" })).json;
      assert.equal(no.totalIngresos, 2000);
      assert.equal(no.decimoTerceroModalidad, "no");
      assert.equal((await api.post("/api/simulacion", { sueldo: 2000, decimos: "tal vez" })).status, 400);
    } finally {
      api.cerrar();
    }
  });
});
