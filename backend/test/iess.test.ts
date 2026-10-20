import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { planillaIess } from "../src/iess.ts";
import { iniciar, cargarEmpleadosDePrueba } from "./ayuda.ts";
import type { Cliente } from "./ayuda.ts";

/** Fila de roles_detalle con solo lo que usa la planilla. */
const fila = (extra: Record<string, string | number>) => ({
  cedula: "1801234566", nombres: "Ana", regimen_aplicado: "CODIGO_TRABAJO", dias_trabajados: 30,
  ingresos_aportables: 1000, aporte_iess: 94.5, tasa_iess_personal: 0.0945, aporte_patronal: 111.5,
  tasa_iess_patronal: 0.1115, fondos_reserva: 0, fondos_reserva_modalidad: "mensual", ...extra,
});

describe("planillaIess: cuadro para contrastar con el comprobante del IESS", () => {
  it("separa lo personal, lo patronal y el total de aportes de cada empleado", () => {
    const [f] = planillaIess(2026, 10, [fila({})]).filas;
    assert.equal(f.materiaGravada, 1000);
    assert.equal(f.aportePersonal, 94.5);
    assert.equal(f.aportePatronal, 111.5);
    assert.equal(f.totalAportes, 206); // 94.50 + 111.50
    assert.equal(f.tasaPersonal, 0.0945);
  });

  it("los fondos de reserva se reparten entre lo que se deposita y lo que se pagó en el rol", () => {
    const { filas, totales } = planillaIess(2026, 10, [
      fila({ fondos_reserva: 83.3, fondos_reserva_modalidad: "acumulado" }),
      fila({ cedula: "1702345677", fondos_reserva: 149.94, fondos_reserva_modalidad: "mensual" }),
      fila({ cedula: "0903456788", fondos_reserva: 0, fondos_reserva_modalidad: "no" }),
    ]);
    assert.equal(filas[0].fondosADepositar, 83.3);
    assert.equal(filas[0].fondosPagadosEnRol, 0);
    assert.equal(filas[1].fondosADepositar, 0);
    assert.equal(filas[1].fondosPagadosEnRol, 149.94);
    assert.equal(filas[2].fondosADepositar + filas[2].fondosPagadosEnRol, 0);
    assert.equal(totales.fondosADepositar, 83.3);
    assert.equal(totales.fondosPagadosEnRol, 149.94);
  });

  it("los totales suman centavos exactos, sin errores de punto flotante", () => {
    const filas = [0.1, 0.2, 0.3].map((v, i) =>
      fila({ cedula: String(i), aporte_iess: v, aporte_patronal: v, ingresos_aportables: v }),
    );
    const { totales } = planillaIess(2026, 10, filas);
    assert.equal(totales.aportePersonal, 0.6); // 0.1 + 0.2 + 0.3 en flotante da 0.6000000000000001
    assert.equal(totales.totalAportes, 1.2);
  });

  it("un rol sin empleados da totales en cero", () => {
    const { filas, totales } = planillaIess(2026, 10, []);
    assert.equal(filas.length, 0);
    assert.equal(totales.totalAportes, 0);
  });
});

async function conRol(prueba: (api: Cliente, id: number) => Promise<void>) {
  const api = await iniciar();
  try {
    await cargarEmpleadosDePrueba(api);
    const { id } = (await api.post("/api/roles/generar", { anio: 2026, mes: 10, novedades: [] })).json;
    await prueba(api, id);
  } finally {
    api.cerrar();
  }
}

describe("API de conciliación con el IESS", () => {
  it("calcula a mano: Código del Trabajo, LOSEP y LOEP según su régimen", () =>
    conRol(async (api, id) => {
      const { filas } = (await api.get(`/api/roles/${id}/iess`)).json;
      const de = (nombre: string) => filas.find((f: { nombres: string }) => f.nombres.startsWith(nombre));

      // María, Código del Trabajo, $4500: 9.45% = 425.25 y 11.15% = 501.75
      const maria = de("María");
      assert.equal(maria.materiaGravada, 4500);
      assert.equal(maria.aportePersonal, 425.25);
      assert.equal(maria.aportePatronal, 501.75);
      assert.equal(maria.totalAportes, 927);

      // Lucía, LOSEP, $675: 11.45% = 77.2875 -> 77.29 y 9.15% = 61.7625 -> 61.76
      const lucia = de("Lucía");
      assert.equal(lucia.regimenAplicado, "LOSEP");
      assert.equal(lucia.aportePersonal, 77.29);
      assert.equal(lucia.aportePatronal, 61.76);
      assert.equal(lucia.totalAportes, 139.05);

      // Pedro, LOEP obrero -> Código del Trabajo, 15 días: $241 -> 9.45% = 22.77 y 11.15% = 26.87
      const pedro = de("Pedro");
      assert.equal(pedro.regimenAplicado, "CODIGO_TRABAJO");
      assert.equal(pedro.diasTrabajados, 15);
      assert.equal(pedro.materiaGravada, 241);
      assert.equal(pedro.aportePersonal, 22.77);
      assert.equal(pedro.aportePatronal, 26.87);
    }));

  it("la materia gravada no incluye los décimos ni los fondos pagados en el rol", () =>
    conRol(async (api, id) => {
      const rol = (await api.get(`/api/roles/${id}`)).json;
      const { filas } = (await api.get(`/api/roles/${id}/iess`)).json;
      const carlos = rol.detalle.find((d: { nombres: string }) => d.nombres.startsWith("Carlos"));
      const filaCarlos = filas.find((f: { nombres: string }) => f.nombres.startsWith("Carlos"));
      assert.ok(carlos.totalIngresos > carlos.ingresosAportables); // cobra décimos y fondos en el rol
      assert.equal(filaCarlos.materiaGravada, carlos.ingresosAportables);
      assert.equal(filaCarlos.materiaGravada, 1800);
      assert.equal(filaCarlos.fondosPagadosEnRol, 149.94);
      assert.equal(filaCarlos.fondosADepositar, 0);
    }));

  it("los totales coinciden con la suma del rol", () =>
    conRol(async (api, id) => {
      const rol = (await api.get(`/api/roles/${id}`)).json;
      const { filas, totales } = (await api.get(`/api/roles/${id}/iess`)).json;
      const suma = (campo: string) =>
        Number(rol.detalle.reduce((s: number, d: Record<string, number>) => s + d[campo], 0).toFixed(2));
      assert.equal(filas.length, 6);
      assert.equal(totales.aportePersonal, suma("aporteIess"));
      assert.equal(totales.aportePatronal, suma("aportePatronal"));
      assert.equal(totales.materiaGravada, suma("ingresosAportables"));
      assert.equal(totales.totalAportes, Number((totales.aportePersonal + totales.aportePatronal).toFixed(2)));
    }));

  it("un empleado que acumula sus fondos de reserva aparece con el valor a depositar", () =>
    conRol(async (api) => {
      const { json: carlos } = await api.get("/api/empleados/2");
      const { id: _id, activo: _a, ...datos } = carlos;
      await api.put("/api/empleados/2", { ...datos, pagoFondosReserva: "acumulado" });
      const { id } = (await api.post("/api/roles/generar", { anio: 2026, mes: 10, novedades: [] })).json;
      const { filas, totales } = (await api.get(`/api/roles/${id}/iess`)).json;
      const f = filas.find((x: { nombres: string }) => x.nombres.startsWith("Carlos"));
      assert.equal(f.fondosADepositar, 149.94);
      assert.equal(f.fondosPagadosEnRol, 0);
      assert.equal(totales.fondosADepositar, 149.94);
    }));

  it("exporta el CSV con encabezado, una línea por empleado y la fila TOTAL", () =>
    conRol(async (api, id) => {
      const r = await api.get(`/api/roles/${id}/iess.csv`);
      assert.match(r.tipo, /text\/csv/);
      const lineas = r.texto.trim().split("\n");
      assert.equal(lineas.length, 8); // encabezado + 6 empleados + total
      assert.ok(lineas[0].startsWith("cedula,nombres,regimen,dias_trabajados,materia_gravada"));
      assert.ok(lineas[7].startsWith("TOTAL,"));
      assert.ok(lineas.some((l) => l.includes("1801234566") && l.includes("425.25")));
    }));

  it("devuelve 404 si el rol no existe", async () => {
    const api = await iniciar();
    try {
      assert.equal((await api.get("/api/roles/99/iess")).status, 404);
      assert.equal((await api.get("/api/roles/99/iess.csv")).status, 404);
    } finally {
      api.cerrar();
    }
  });
});
