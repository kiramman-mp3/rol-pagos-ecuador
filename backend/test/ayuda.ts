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

export const EMPLEADO = {
  cedula: "1801234566", nombres: "Ana Prueba", cargo: "Analista",
  sueldoBase: 1000, fechaIngreso: "2024-01-10", tipoContrato: "Indefinido",
};
