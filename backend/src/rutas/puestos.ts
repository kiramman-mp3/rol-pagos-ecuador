import { Router } from "express";

import { actualizarPuesto, asignarResponsable, buscarPuesto, crearPuesto, eliminarPuesto, listarPuestos } from "../puestos.ts";
import type { Base } from "../db.ts";
import { ErrorApi } from "../validaciones.ts";

export function rutasPuestos(db: Base): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listarPuestos(db));
  });

  router.get("/:id", async (req, res) => {
    const puesto = await buscarPuesto(db, Number(req.params.id));
    if (!puesto) throw new ErrorApi(404, ["El puesto no existe."]);
    res.json(puesto);
  });

  router.post("/", async (req, res) => {
    res.status(201).json(await crearPuesto(db, req.body ?? {}));
  });

  router.put("/:id", async (req, res) => {
    res.json(await actualizarPuesto(db, Number(req.params.id), req.body ?? {}));
  });

  /** Asigna (`{ empleadoId: 3 }`) o quita (`{ empleadoId: null }`) al responsable del puesto. */
  router.patch("/:id/responsable", async (req, res) => {
    res.json(await asignarResponsable(db, Number(req.params.id), req.body?.empleadoId));
  });

  router.delete("/:id", async (req, res) => {
    await eliminarPuesto(db, Number(req.params.id));
    res.status(204).end();
  });

  return router;
}
