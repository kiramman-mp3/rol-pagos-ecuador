import { Router } from "express";

import { actualizarRegimen, buscarRegimen, listarRegimenes } from "../regimenes.ts";
import type { Base } from "../db.ts";
import { ErrorApi } from "../validaciones.ts";

export function rutasRegimenes(db: Base): Router {
  const router = Router();

  router.get("/", async (_req, res) => {
    res.json(await listarRegimenes(db));
  });

  router.get("/:codigo", async (req, res) => {
    const regimen = await buscarRegimen(db, req.params.codigo);
    if (!regimen) throw new ErrorApi(404, ["El régimen no existe."]);
    res.json(regimen);
  });

  /** Edita las reglas de un régimen: aportes, recargos, topes, vacaciones y beneficios. */
  router.put("/:codigo", async (req, res) => {
    res.json(await actualizarRegimen(db, req.params.codigo, req.body ?? {}));
  });

  return router;
}
