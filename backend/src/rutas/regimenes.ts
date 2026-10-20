import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";

import { actualizarRegimen, buscarRegimen, listarRegimenes } from "../regimenes.ts";
import { ErrorApi } from "../validaciones.ts";

export function rutasRegimenes(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(listarRegimenes(db));
  });

  router.get("/:codigo", (req, res) => {
    const regimen = buscarRegimen(db, req.params.codigo);
    if (!regimen) throw new ErrorApi(404, ["El régimen no existe."]);
    res.json(regimen);
  });

  /** Edita las reglas de un régimen: aportes, recargos, topes, vacaciones y beneficios. */
  router.put("/:codigo", (req, res) => {
    res.json(actualizarRegimen(db, req.params.codigo, req.body ?? {}));
  });

  return router;
}
