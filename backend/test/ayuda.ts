import type { AddressInfo } from "node:net";

import { crearApp } from "../src/app.ts";

export interface Cliente {
  get: (ruta: string) => Promise<Respuesta>;
  post: (ruta: string, cuerpo?: unknown) => Promise<Respuesta>;
  put: (ruta: string, cuerpo?: unknown) => Promise<Respuesta>;
  patch: (ruta: string) => Promise<Respuesta>;
  del: (ruta: string) => Promise<Respuesta>;
  cerrar: () => void;
}

export interface Respuesta {
  status: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  json: any;
  texto: string;
  tipo: string;
}

/** Levanta la API en un puerto libre con una base en memoria, para una prueba. */
export async function iniciar(): Promise<Cliente> {
  const { app, db } = crearApp({ rutaBase: ":memory:" });
  const servidor = await new Promise<ReturnType<typeof app.listen>>((resolver) => {
    const s = app.listen(0, () => resolver(s));
  });
  const base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;

  const pedir = async (metodo: string, ruta: string, cuerpo?: unknown): Promise<Respuesta> => {
    const r = await fetch(base + ruta, {
      method: metodo,
      headers: cuerpo === undefined ? {} : { "Content-Type": "application/json" },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
    });
    const texto = await r.text();
    let json: unknown = null;
    try {
      json = JSON.parse(texto);
    } catch {
      /* respuestas que no son JSON (CSV, 204) */
    }
    return { status: r.status, json, texto, tipo: r.headers.get("content-type") ?? "" };
  };

  return {
    get: (ruta) => pedir("GET", ruta),
    post: (ruta, cuerpo = {}) => pedir("POST", ruta, cuerpo),
    put: (ruta, cuerpo = {}) => pedir("PUT", ruta, cuerpo),
    patch: (ruta) => pedir("PATCH", ruta),
    del: (ruta) => pedir("DELETE", ruta),
    cerrar: () => {
      servidor.close();
      db.close();
    },
  };
}

/** Id del nivel E2 (mínimo $482) de la escala del Código del Trabajo: el último que siembra la migración 007. */
export const NIVEL_E2_CT = 33;

/** Puesto "Auxiliar de guardalmacén" del orgánico de ejemplo (nivel E2). */
export const PUESTO_AUXILIAR = 5;

/** Empleado válido del Código del Trabajo: exige un puesto del orgánico y su nivel (el sueldo puede superar el mínimo). */
export const EMPLEADO = {
  cedula: "1801234566", nombres: "Ana Prueba", cargo: "Analista",
  sueldoBase: 1000, fechaIngreso: "2024-01-10", tipoContrato: "Indefinido", escalaId: NIVEL_E2_CT,
  puestoId: PUESTO_AUXILIAR,
};

/**
 * Los seis empleados con los que están calculadas a mano las pruebas de roles, IESS y regímenes:
 * 1 y 2 y 4 = Código del Trabajo, 3 = LOSEP, 5 = LOEP servidor, 6 = LOEP obrero.
 * Se crean por la API (con su puesto o grado), en este orden, para que sus ids sean del 1 al 6.
 */
export async function cargarEmpleadosDePrueba(api: Cliente) {
  const losep = (await api.get("/api/escala?regimen=LOSEP")).json;
  const grado = (n: number) => losep.find((g: { grado: number }) => g.grado === n).id;
  const base = { tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO" };
  const empleados = [
    { ...base, cedula: "1801234566", nombres: "María Fernanda Paredes", cargo: "Gerente General", sueldoBase: 4500, fechaIngreso: "2019-03-01", puestoId: 1 },
    { ...base, cedula: "1702345677", nombres: "Carlos Andrés Villacís", cargo: "Contador", sueldoBase: 1800, fechaIngreso: "2022-07-15", puestoId: 2 },
    { ...base, cedula: "0903456788", nombres: "Lucía Estefanía Mora", cargo: "Asistente Administrativa", sueldoBase: 675, fechaIngreso: "2024-02-01", tipoContrato: "Plazo fijo", regimen: "LOSEP", escalaId: grado(5) },
    { ...base, cedula: "0104567896", nombres: "José Luis Camacho", cargo: "Vendedor", sueldoBase: 900, fechaIngreso: "2025-11-03", puestoId: 3 },
    { ...base, cedula: "1715678908", nombres: "Daniela Alejandra Ruiz", cargo: "Analista de Sistemas", sueldoBase: 2670, fechaIngreso: "2023-05-10", regimen: "LOEP", categoriaLoep: "servidor", escalaId: grado(19) },
    { ...base, cedula: "0606789014", nombres: "Pedro Pablo Guamán", cargo: "Bodeguero", sueldoBase: 482, fechaIngreso: "2026-10-16", tipoContrato: "Eventual", regimen: "LOEP", categoriaLoep: "obrero", puestoId: PUESTO_AUXILIAR },
  ];
  for (const e of empleados) {
    const r = await api.post("/api/empleados", e);
    if (r.status !== 201) throw new Error(`No se pudo crear a ${e.nombres}: ${JSON.stringify(r.json)}`);
  }
}
