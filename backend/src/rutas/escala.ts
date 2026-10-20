import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";

import { actualizarGrado, buscarGrado, crearGrado, eliminarGrado, listarEscala } from "../escala.ts";
import { ErrorApi } from "../validaciones.ts";

export function rutasEscala(db: DatabaseSync): Router {
  const router = Router();

  /** Todos los grados, o solo los de un régimen con `?regimen=LOSEP`. */
  router.get("/", (req, res) => {
    const regimen = typeof req.query.regimen === "string" ? req.query.regimen : undefined;
    res.json(listarEscala(db, regimen));
  });

  router.get("/:id", (req, res) => {
    const grado = buscarGrado(db, Number(req.params.id));
    if (!grado) throw new ErrorApi(404, ["El grado no existe."]);
    res.json(grado);
  });

  router.post("/", (req, res) => {
    res.status(201).json(crearGrado(db, req.body ?? {}));
  });

  router.put("/:id", (req, res) => {
    res.json(actualizarGrado(db, Number(req.params.id), req.body ?? {}));
  });

  router.delete("/:id", (req, res) => {
    eliminarGrado(db, Number(req.params.id));
    res.status(204).end();
  });

  return router;
}
