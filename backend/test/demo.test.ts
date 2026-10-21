import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { abrirBase, consultar } from "../src/db.ts";
import { cargarEmpleadosDemo, generarRolesDemo } from "../src/demo.ts";

describe("seed de ejemplo", () => {
  it("carga los empleados una sola vez y genera los roles de enero a septiembre", () => {
    const db = abrirBase(":memory:");
    try {
      assert.equal(cargarEmpleadosDemo(db), 12);
      assert.equal(cargarEmpleadosDemo(db), 0);
      assert.equal(generarRolesDemo(db), 9);

      const roles = consultar(db, "SELECT anio, mes, num_empleados FROM roles_cabecera ORDER BY mes");
      assert.deepEqual(roles.map((r) => r.mes), [1, 2, 3, 4, 5, 6, 7, 8, 9]); // sin octubre
      assert.ok(roles.every((r) => r.anio === 2026));
      // Mayra ingresó en marzo y Pedro en octubre: solo aparecen cuando ya trabajaban
      assert.deepEqual(roles.map((r) => r.num_empleados), [10, 10, 11, 11, 11, 11, 11, 11, 11]);
    } finally {
      db.close();
    }
  });

  it("los roles de ejemplo traen horas extras y un neto positivo para cada empleado", () => {
    const db = abrirBase(":memory:");
    try {
      cargarEmpleadosDemo(db);
      generarRolesDemo(db);
      const detalle = consultar(db, "SELECT neto_pagar, valor_horas_suplementarias FROM roles_detalle");
      assert.ok(detalle.every((d) => Number(d.neto_pagar) > 0));
      assert.ok(detalle.some((d) => Number(d.valor_horas_suplementarias) > 0));
    } finally {
      db.close();
    }
  });
});
