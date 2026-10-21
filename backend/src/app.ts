import { existsSync } from "node:fs";
import { join } from "node:path";

import express from "express";
import type { ErrorRequestHandler } from "express";

import type { Base } from "./db.ts";
import { rutasEmpleados } from "./rutas/empleados.ts";
import { rutasEscala } from "./rutas/escala.ts";
import { rutasParametros } from "./rutas/parametros.ts";
import { rutasPuestos } from "./rutas/puestos.ts";
import { rutasRegimenes } from "./rutas/regimenes.ts";
import { rutasRoles } from "./rutas/roles.ts";
import { ErrorApi } from "./validaciones.ts";

interface Opciones {
  /** Carpeta con el build de Angular; si existe, se sirve desde aquí. */
  carpetaFrontend?: string;
}

export function crearApp(db: Base, { carpetaFrontend }: Opciones = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "100kb" }));

  app.use("/api/empleados", rutasEmpleados(db));
  app.use("/api/roles", rutasRoles(db));
  app.use("/api/regimenes", rutasRegimenes(db));
  app.use("/api/escala", rutasEscala(db));
  app.use("/api/puestos", rutasPuestos(db));
  app.use("/api", rutasParametros(db));
  app.use("/api", (_req, _res, next) => next(new ErrorApi(404, ["Ruta no encontrada."])));

  // En producción, Express también entrega la aplicación Angular.
  if (carpetaFrontend && existsSync(join(carpetaFrontend, "index.html"))) {
    app.use(express.static(carpetaFrontend));
    // Cualquier otra ruta es de Angular (/sistema/empleados, etc.).
    app.use((req, res, next) => {
      if (req.method !== "GET") return next();
      res.sendFile(join(carpetaFrontend, "index.html"));
    });
  }

  const manejarErrores: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof ErrorApi) {
      res.status(error.status).json({ errores: error.errores });
    } else if (error instanceof SyntaxError && "body" in error) {
      res.status(400).json({ errores: ["El cuerpo de la petición no es JSON válido."] });
    } else {
      console.error(error);
      res.status(500).json({ errores: ["Error interno del servidor."] });
    }
  };
  app.use(manejarErrores);

  return app;
}
