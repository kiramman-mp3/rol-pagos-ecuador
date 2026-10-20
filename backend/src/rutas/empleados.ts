import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";

import { CONTRATOS, EMPLEADOS_DEMO } from "../config.ts";
import { MODALIDADES } from "../calculos.ts";
import type { Modalidad } from "../calculos.ts";
import { consultar, ejecutar, filaACamel, uno } from "../db.ts";
import type { Fila } from "../db.ts";
import { parametrosDelAnio } from "../parametros.ts";
import { buscarGrado, listarEscala } from "../escala.ts";
import { buscarPuesto, listarPuestos } from "../puestos.ts";
import { CATEGORIAS_LOEP, indexarRegimenes, listarRegimenes, regimenAplicado } from "../regimenes.ts";
import { aDecimal, cedulaValida, ErrorApi, fechaIsoValida } from "../validaciones.ts";

interface DatosEmpleado {
  cedula: string;
  nombres: string;
  cargo: string;
  sueldoBase: number;
  fechaIngreso: string;
  tipoContrato: string;
  regimen: string;
  categoriaLoep: string | null;
  escalaId: number | null;
  puestoId: number | null;
  /** null = lo que diga el régimen */
  pagoDecimoTercero: Modalidad | null;
  pagoDecimoCuarto: Modalidad | null;
  pagoFondosReserva: Modalidad | null;
  recibeHorasExtras: boolean | null;
}

/** Reglas de negocio del formulario. Devuelve los datos limpios y los avisos no bloqueantes. */
function validar(
  db: DatabaseSync, cuerpo: Record<string, unknown>,
): { datos: DatosEmpleado; avisos: string[] } {
  const texto = (campo: string) => String(cuerpo[campo] ?? "").trim();
  const errores: string[] = [];
  const avisos: string[] = [];

  const cedula = texto("cedula");
  const nombres = texto("nombres");
  const cargo = texto("cargo");
  const tipoContrato = texto("tipoContrato");
  const fechaIngreso = texto("fechaIngreso");
  const regimen = texto("regimen") || "CODIGO_TRABAJO";

  if (!cedulaValida(cedula)) errores.push("La cédula no es válida (10 dígitos, módulo 10).");
  if (!nombres || !cargo) errores.push("Nombres y cargo son obligatorios.");
  if (!CONTRATOS.includes(tipoContrato)) errores.push("Tipo de contrato inválido.");
  if (!fechaIsoValida(fechaIngreso)) errores.push("Fecha de ingreso inválida.");

  // El régimen existe y, si es mixto (LOEP), hace falta saber si es servidor u obrero.
  const elegido = indexarRegimenes(listarRegimenes(db)).get(regimen);
  let categoriaLoep: string | null = null;
  if (!elegido) {
    errores.push("El régimen laboral no existe.");
  } else if (elegido.tipo === "mixto") {
    categoriaLoep = texto("categoriaLoep");
    if (!(CATEGORIAS_LOEP as readonly string[]).includes(categoriaLoep)) {
      errores.push(`${elegido.nombre}: indica si el empleado es servidor u obrero.`);
    }
  }

  const vacio = (v: unknown) => v === null || v === undefined || v === "";
  let aplicado: string | null = null;
  if (elegido) {
    try {
      aplicado = regimenAplicado(indexarRegimenes(listarRegimenes(db)), regimen, categoriaLoep).codigo;
    } catch {
      /* la categoría faltante ya quedó reportada arriba */
    }
  }

  // Puesto del orgánico: si el régimen aplicado tiene puestos, se identifica primero (función,
  // responsabilidad, sector) y de él sale el nivel de la escala que sirve de referencia al sueldo.
  let puestoId: number | null = null;
  const puesto = vacio(cuerpo.puestoId) ? undefined : buscarPuesto(db, Number(cuerpo.puestoId));
  const hayPuestos = aplicado !== null && listarPuestos(db).some((p) => p.referencia?.regimen === aplicado);
  if (!vacio(cuerpo.puestoId)) {
    if (!puesto) errores.push("El puesto no existe.");
    else if (aplicado && puesto.referencia && puesto.referencia.regimen !== aplicado) {
      errores.push(`El puesto «${puesto.nombre}» es de la escala ${puesto.referencia.regimen}, no de ${aplicado}.`);
    } else puestoId = puesto.id;
  } else if (hayPuestos) {
    errores.push("Elige el puesto del orgánico: de él sale la función y el nivel salarial de referencia.");
  }

  // Grado de la escala salarial: si el régimen que se aplica tiene escala, el grado es obligatorio
  // y debe ser de esa escala; si hay puesto, se propone el de su referencia y se avisa si es otro. El sueldo sale de la tabla.
  let escalaId: number | null = null;
  const pedido = vacio(cuerpo.escalaId) && puestoId !== null ? puesto?.escalaId : cuerpo.escalaId;
  const hayPedido = !vacio(pedido);
  const grado = hayPedido ? buscarGrado(db, Number(pedido)) : undefined;
  if (hayPedido) {
    if (!grado) errores.push("El grado de la escala salarial no existe.");
    else if (aplicado && grado.regimen !== aplicado) {
      errores.push(`El grado ${grado.grado} es de la escala ${grado.regimen}, no de ${aplicado}.`);
    } else {
      escalaId = grado.id;
      if (puesto && grado.id !== puesto.escalaId) {
        avisos.push(`Aviso: el nivel ${grado.denominacion} difiere de la referencia del puesto «${puesto.nombre}».`);
      }
    }
  } else if (aplicado && listarEscala(db, aplicado).length > 0) {
    errores.push(`Elige un grado de la escala salarial ${aplicado}: el sueldo se toma de la tabla.`);
  }

  // Opciones de pago: vacío = lo que diga el régimen.
  const modalidad = (campo: string, etiqueta: string): Modalidad | null => {
    const valor = cuerpo[campo];
    if (valor === null || valor === undefined || valor === "") return null;
    if (!MODALIDADES.includes(valor as Modalidad)) {
      errores.push(`${etiqueta}: elige 'no', 'mensual' o 'acumulado'.`);
      return null;
    }
    return valor as Modalidad;
  };
  const pagoDecimoTercero = modalidad("pagoDecimoTercero", "Décimo tercero");
  const pagoDecimoCuarto = modalidad("pagoDecimoCuarto", "Décimo cuarto");
  const pagoFondosReserva = modalidad("pagoFondosReserva", "Fondos de reserva");
  const horas = cuerpo.recibeHorasExtras;
  if (horas !== null && horas !== undefined && horas !== "" && typeof horas !== "boolean") {
    errores.push("Horas extras: indica si las recibe o deja la opción del régimen.");
  }
  const recibeHorasExtras = typeof horas === "boolean" ? horas : null;

  let sueldoBase = 0;
  try {
    sueldoBase = aDecimal(cuerpo.sueldoBase).toNumber();
    if (sueldoBase <= 0) errores.push("El sueldo base debe ser mayor a cero.");
    else {
      // El SBU del año en curso sale de la base, no de una constante.
      const { parametros } = parametrosDelAnio(db, new Date().getFullYear());
      if (grado && escalaId !== null && grado.esMinimo && sueldoBase < grado.rmu) {
        errores.push(
          `No se puede registrar al empleado: el sueldo ($${sueldoBase}) es menor al mínimo del nivel ${grado.denominacion} ($${grado.rmu}).`,
        );
      } else if (sueldoBase < parametros.sbu) {
        errores.push(
          `No se puede registrar al empleado: el sueldo ($${sueldoBase}) es menor al salario básico unificado ${parametros.anio} ($${parametros.sbu}).`,
        );
      }
      if (grado && escalaId !== null && !grado.esMinimo && sueldoBase !== grado.rmu) {
        errores.push(`El sueldo ($${sueldoBase}) debe ser la RMU del grado ${grado.grado} ($${grado.rmu}).`);
      }
    }
  } catch (error) {
    errores.push(`Sueldo base: ${(error as Error).message}.`);
  }

  if (errores.length) throw new ErrorApi(400, errores);
  return {
    datos: {
      cedula, nombres, cargo, sueldoBase, fechaIngreso, tipoContrato, regimen, categoriaLoep, escalaId, puestoId,
      pagoDecimoTercero, pagoDecimoCuarto, pagoFondosReserva, recibeHorasExtras,
    },
    avisos,
  };
}

const aApi = (fila: Fila) => ({
  ...filaACamel(fila),
  activo: fila.activo === 1,
  recibeHorasExtras: fila.recibe_horas_extras === null ? null : fila.recibe_horas_extras === 1,
});

export function rutasEmpleados(db: DatabaseSync): Router {
  const router = Router();

  const buscar = (idTexto: string): Fila => {
    const fila = uno(db, "SELECT * FROM empleados WHERE id = ?", Number(idTexto));
    if (!fila) throw new ErrorApi(404, ["El empleado no existe."]);
    return fila;
  };

  /** Traduce el choque con la restricción UNIQUE de la cédula a un 409 legible. */
  const guardar = (accion: () => void) => {
    try {
      accion();
    } catch (error) {
      if (String((error as Error).message).includes("UNIQUE")) {
        throw new ErrorApi(409, ["Ya existe un empleado con esa cédula."]);
      }
      throw error;
    }
  };

  router.get("/", (_req, res) => {
    res.json(consultar(db, "SELECT * FROM empleados ORDER BY activo DESC, nombres").map(aApi));
  });

  router.post("/demo", (_req, res) => {
    let nuevos = 0;
    for (const e of EMPLEADOS_DEMO) {
      const r = ejecutar(
        db,
        `INSERT OR IGNORE INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso,
         tipo_contrato, regimen, categoria_loep, escala_id, puesto_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?,
                 (SELECT id FROM escala_salarial WHERE regimen = ? AND grado = ?),
                 (SELECT id FROM puestos WHERE nombre = ?))`,
        e.cedula, e.nombres, e.cargo, e.sueldoBase, e.fechaIngreso, e.tipoContrato, e.regimen, e.categoriaLoep,
        e.escalaRegimen, e.escalaGrado, e.puesto,
      );
      nuevos += Number(r.changes);
    }
    res.status(201).json({ agregados: nuevos });
  });

  router.get("/:id", (req, res) => {
    res.json(aApi(buscar(req.params.id)));
  });

  router.post("/", (req, res) => {
    const { datos, avisos } = validar(db, req.body ?? {});
    let id = 0;
    guardar(() => {
      const r = ejecutar(
        db,
        `INSERT INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso, tipo_contrato,
         regimen, categoria_loep, escala_id, puesto_id, pago_decimo_tercero, pago_decimo_cuarto,
         pago_fondos_reserva, recibe_horas_extras) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        datos.cedula, datos.nombres, datos.cargo, datos.sueldoBase, datos.fechaIngreso,
        datos.tipoContrato, datos.regimen, datos.categoriaLoep, datos.escalaId, datos.puestoId,
        datos.pagoDecimoTercero, datos.pagoDecimoCuarto, datos.pagoFondosReserva,
        datos.recibeHorasExtras === null ? null : Number(datos.recibeHorasExtras),
      );
      id = Number(r.lastInsertRowid);
    });
    res.status(201).json({ ...aApi(buscar(String(id))), avisos });
  });

  router.put("/:id", (req, res) => {
    const actual = buscar(req.params.id);
    const { datos, avisos } = validar(db, req.body ?? {});
    guardar(() => {
      ejecutar(
        db,
        `UPDATE empleados SET cedula = ?, nombres = ?, cargo = ?, sueldo_base = ?,
         fecha_ingreso = ?, tipo_contrato = ?, regimen = ?, categoria_loep = ?, escala_id = ?, puesto_id = ?,
         pago_decimo_tercero = ?, pago_decimo_cuarto = ?, pago_fondos_reserva = ?, recibe_horas_extras = ?
         WHERE id = ?`,
        datos.cedula, datos.nombres, datos.cargo, datos.sueldoBase, datos.fechaIngreso,
        datos.tipoContrato, datos.regimen, datos.categoriaLoep, datos.escalaId, datos.puestoId,
        datos.pagoDecimoTercero, datos.pagoDecimoCuarto, datos.pagoFondosReserva,
        datos.recibeHorasExtras === null ? null : Number(datos.recibeHorasExtras), actual.id,
      );
    });
    res.json({ ...aApi(buscar(req.params.id)), avisos });
  });

  router.patch("/:id/estado", (req, res) => {
    const actual = buscar(req.params.id);
    ejecutar(db, "UPDATE empleados SET activo = 1 - activo WHERE id = ?", actual.id);
    res.json(aApi(buscar(req.params.id)));
  });

  router.delete("/:id", (req, res) => {
    const actual = buscar(req.params.id);
    ejecutar(db, "DELETE FROM empleados WHERE id = ?", actual.id);
    res.status(204).end();
  });

  return router;
}
