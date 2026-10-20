import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";

import { calcularRol, REGLAS_CT_2026 } from "../calculos.ts";
import { CONTRATOS, EMPRESA, MESES } from "../config.ts";
import {
  aniosConParametros, guardarParametros, parametrosDelAnio, validarTablaIr,
} from "../parametros.ts";
import { reglasDe } from "../reglas.ts";
import { aDecimal, ErrorApi } from "../validaciones.ts";

export function rutasParametros(db: DatabaseSync): Router {
  const router = Router();

  /** Reglas de ley de un año (por defecto el actual): el frontend las muestra sin repetirlas. */
  router.get("/parametros", (req, res) => {
    const pedido = Number(req.query.anio ?? new Date().getFullYear());
    const { parametros, exacto } = parametrosDelAnio(db, Number.isInteger(pedido) ? pedido : new Date().getFullYear());
    res.json({
      anio: parametros.anio,
      anioSolicitado: pedido,
      exacto,
      anios: aniosConParametros(db),
      sbu: parametros.sbu,
      fuente: parametros.fuente,
      iessPersonal: Number(REGLAS_CT_2026.iessPersonal),
      iessPatronal: Number(REGLAS_CT_2026.iessPatronal),
      fondosReserva: Number(REGLAS_CT_2026.fondosReserva),
      fraccionExentaIr: parametros.tablaIr[0].hasta,
      tablaIr: parametros.tablaIr,
      empresa: EMPRESA,
      meses: MESES,
      contratos: CONTRATOS,
    });
  });

  /** Crea o actualiza los parámetros de un año (SBU y tabla del IR). */
  router.put("/parametros/:anio", (req, res) => {
    const anio = Number(req.params.anio);
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new ErrorApi(400, ["Año inválido."]);
    const cuerpo = req.body ?? {};
    const errores: string[] = [];
    let sbu = 0;
    try {
      sbu = aDecimal(cuerpo.sbu, 0).toNumber();
      if (sbu <= 0) errores.push("El SBU debe ser mayor a cero.");
    } catch (error) {
      errores.push(`SBU: ${(error as Error).message}.`);
    }
    if (errores.length) throw new ErrorApi(400, errores);
    const tabla = validarTablaIr(cuerpo.tablaIr);
    guardarParametros(db, anio, sbu, tabla, String(cuerpo.fuente ?? "").slice(0, 300));
    res.json(parametrosDelAnio(db, anio).parametros);
  });

  /**
   * Calcula un rol de ejemplo para un empleado con más de un año de antigüedad.
   * No guarda nada: sirve para la demostración de la página de inicio.
   */
  router.post("/simulacion", (req, res) => {
    const cuerpo = req.body ?? {};
    const errores: string[] = [];
    const campo = (nombre: string, minimo: number, maximo: number, etiqueta: string) => {
      try {
        const valor = aDecimal(cuerpo[nombre], minimo);
        if (valor.gt(maximo)) throw new Error(`debe ser menor o igual a ${maximo}`);
        return valor;
      } catch (error) {
        errores.push(`${etiqueta}: ${(error as Error).message}.`);
        return aDecimal(0);
      }
    };
    const sueldoBase = campo("sueldo", 1, 100000, "Sueldo");
    const horasSuplementarias = campo("horasSuplementarias", 0, 100, "Horas suplementarias");
    const horasExtraordinarias = campo("horasExtraordinarias", 0, 100, "Horas extraordinarias");
    const comisiones = campo("comisiones", 0, 100000, "Comisiones");
    if (errores.length) throw new ErrorApi(400, errores);

    res.json(
      calcularRol({
        sueldoBase, horasSuplementarias, horasExtraordinarias, comisiones,
        fechaIngreso: "2020-01-01", anio: 2026, mes: 10,
      }, reglasDe(parametrosDelAnio(db, 2026).parametros)),
    );
  });

  return router;
}
