/**
 * Conciliación con el IESS.
 *
 * El IESS no publica un formato de archivo para subir los aportes: genera la planilla en su
 * portal a partir de los avisos de entrada y salida y las novedades que declara el empleador, y
 * el comprobante se puede descargar en Excel. Por eso este módulo no produce un archivo de carga:
 * arma el cuadro que sale del rol (materia gravada y aportes por empleado) para contrastarlo
 * con ese comprobante, línea por línea.
 */
import { Decimal } from "decimal.js";

import type { Fila } from "./db.ts";

export interface FilaIess {
  cedula: string;
  nombres: string;
  regimenAplicado: string;
  diasTrabajados: number;
  /** Lo que sirve de base para el aporte: sin décimos ni fondos pagados en el rol. */
  materiaGravada: number;
  tasaPersonal: number;
  aportePersonal: number;
  tasaPatronal: number;
  aportePatronal: number;
  totalAportes: number;
  /** Fondos de reserva que el empleador deposita en el IESS porque el trabajador los acumula. */
  fondosADepositar: number;
  /** Fondos de reserva que ya se pagaron al trabajador dentro del rol. */
  fondosPagadosEnRol: number;
}

export type TotalesIess = Omit<FilaIess, "cedula" | "nombres" | "regimenAplicado" | "tasaPersonal" | "tasaPatronal" | "diasTrabajados">;

export interface PlanillaIess {
  anio: number;
  mes: number;
  filas: FilaIess[];
  totales: TotalesIess;
}

const suma = (valores: number[]) => valores.reduce((total, v) => total.plus(v), new Decimal(0)).toDecimalPlaces(2).toNumber();

/** Arma el cuadro de aportes de un rol a partir de las filas de `roles_detalle`. */
export function planillaIess(anio: number, mes: number, detalle: Fila[]): PlanillaIess {
  const filas: FilaIess[] = detalle.map((d) => {
    const personal = Number(d.aporte_iess);
    const patronal = Number(d.aporte_patronal);
    const fondos = Number(d.fondos_reserva);
    return {
      cedula: String(d.cedula),
      nombres: String(d.nombres),
      regimenAplicado: String(d.regimen_aplicado),
      diasTrabajados: Number(d.dias_trabajados),
      materiaGravada: Number(d.ingresos_aportables),
      tasaPersonal: Number(d.tasa_iess_personal),
      aportePersonal: personal,
      tasaPatronal: Number(d.tasa_iess_patronal),
      aportePatronal: patronal,
      totalAportes: new Decimal(personal).plus(patronal).toNumber(),
      fondosADepositar: d.fondos_reserva_modalidad === "acumulado" ? fondos : 0,
      fondosPagadosEnRol: d.fondos_reserva_modalidad === "mensual" ? fondos : 0,
    };
  });
  const total = (campo: keyof TotalesIess) => suma(filas.map((f) => f[campo]));
  return {
    anio,
    mes,
    filas,
    totales: {
      materiaGravada: total("materiaGravada"),
      aportePersonal: total("aportePersonal"),
      aportePatronal: total("aportePatronal"),
      totalAportes: total("totalAportes"),
      fondosADepositar: total("fondosADepositar"),
      fondosPagadosEnRol: total("fondosPagadosEnRol"),
    },
  };
}
