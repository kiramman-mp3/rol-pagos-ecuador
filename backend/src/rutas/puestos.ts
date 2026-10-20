import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";

import { actualizarPuesto, asignarResponsable, buscarPuesto, crearPuesto, eliminarPuesto, listarPuestos } from "../puestos.ts";
import { ErrorApi } from "../validaciones.ts";

export function rutasPuestos(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(listarPuestos(db));
  });

  router.get("/:id", (req, res) => {
    const puesto = buscarPuesto(db, Number(req.params.id));
    if (!puesto) throw new ErrorApi(404, ["El puesto no existe."]);
    res.json(puesto);
  });

  router.post("/", (req, res) => {
    res.status(201).json(crearPuesto(db, req.body ?? {}));
  });

  router.put("/:id", (req, res) => {
    res.json(actualizarPuesto(db, Number(req.params.id), req.body ?? {}));
  });

  /** Asigna (`{ empleadoId: 3 }`) o quita (`{ empleadoId: null }`) al responsable del puesto. */
  router.patch("/:id/responsable", (req, res) => {
    res.json(asignarResponsable(db, Number(req.params.id), req.body?.empleadoId));
  });

  router.delete("/:id", (req, res) => {
    eliminarPuesto(db, Number(req.params.id));
    res.status(204).end();
  });

  return router;
}
