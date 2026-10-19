import { Router } from "express";

import {
  calcularRol, FONDOS_RESERVA, IESS_PATRONAL, IESS_PERSONAL, SBU, TABLA_IR_2026,
} from "../calculos.ts";
import { CONTRATOS, EMPRESA, MESES } from "../config.ts";
import { aDecimal, ErrorApi } from "../validaciones.ts";

export function rutasParametros(): Router {
  const router = Router();

  /** Reglas de ley vigentes: el frontend las muestra sin repetirlas. */
  router.get("/parametros", (_req, res) => {
    res.json({
      anio: 2026,
      sbu: SBU.toNumber(),
      iessPersonal: IESS_PERSONAL.toNumber(),
      iessPatronal: IESS_PATRONAL.toNumber(),
      fondosReserva: FONDOS_RESERVA.toNumber(),
      fraccionExentaIr: TABLA_IR_2026[0].hasta,
      tablaIr: TABLA_IR_2026,
      empresa: EMPRESA,
      meses: MESES,
      contratos: CONTRATOS,
    });
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
    const horas50 = campo("horas50", 0, 100, "Horas suplementarias");
    const horas100 = campo("horas100", 0, 100, "Horas extraordinarias");
    const comisiones = campo("comisiones", 0, 100000, "Comisiones");
    if (errores.length) throw new ErrorApi(400, errores);

    res.json(
      calcularRol({
        sueldoBase, horas50, horas100, comisiones,
        fechaIngreso: "2020-01-01", anio: 2026, mes: 10,
      }),
    );
  });

  return router;
}
