"""Rutas del rol mensual: capturar novedades, generar, consultar, exportar."""
import csv
import io
from datetime import date, datetime
from decimal import Decimal

from flask import (
    Blueprint,
    Response,
    abort,
    flash,
    redirect,
    render_template,
    request,
    url_for,
)

import db
from calculos import calcular_rol
from validaciones import a_decimal

bp = Blueprint("roles", __name__, url_prefix="/roles")

# campo del formulario -> columna de la tabla novedades
CAMPOS_NOVEDAD = {
    "h50": "horas_50",
    "h100": "horas_100",
    "hnoc": "horas_nocturnas",
    "com": "comisiones",
    "desc": "otros_descuentos",
}


def leer_periodo(origen):
    try:
        anio, mes = int(origen.get("anio")), int(origen.get("mes"))
    except (TypeError, ValueError):
        hoy = date.today()
        return hoy.year, hoy.month
    if not (2020 <= anio <= 2100 and 1 <= mes <= 12):
        abort(400, "Período inválido")
    return anio, mes


def empleados_del_periodo(conn, anio, mes):
    """Activos que ya habían ingresado al cierre del mes (fechas ISO se comparan como texto)."""
    return conn.execute(
        "SELECT * FROM empleados WHERE activo = 1 AND fecha_ingreso <= ? ORDER BY nombres",
        (f"{anio}-{mes:02d}-31",)).fetchall()


def novedades_guardadas(conn, anio, mes):
    filas = conn.execute(
        "SELECT * FROM novedades WHERE anio = ? AND mes = ?", (anio, mes)).fetchall()
    return {f["empleado_id"]: f for f in filas}


@bp.get("")
def lista():
    hoy = date.today()
    historial = db.get_db().execute(
        "SELECT * FROM roles_cabecera ORDER BY anio DESC, mes DESC").fetchall()
    return render_template("roles.html", historial=historial, anio=hoy.year, mes=hoy.month)


@bp.route("/generar", methods=["GET", "POST"])
def generar():
    conn = db.get_db()
    anio, mes = leer_periodo(request.values)
    empleados = empleados_del_periodo(conn, anio, mes)
    if not empleados:
        flash("No hay empleados activos para ese período.", "warning")
        return redirect(url_for("roles.lista"))

    if request.method == "GET":
        return render_template("generar.html", anio=anio, mes=mes, empleados=empleados,
                               novedades=novedades_guardadas(conn, anio, mes),
                               existe=existe_rol(conn, anio, mes))

    # POST: validar todas las novedades antes de tocar la base
    novedades, errores = {}, []
    for e in empleados:
        try:
            novedades[e["id"]] = {
                columna: a_decimal(request.form.get(f"{campo}_{e['id']}"))
                for campo, columna in CAMPOS_NOVEDAD.items()}
        except ValueError as exc:
            errores.append(f"{e['nombres']}: {exc}.")
    if errores:
        for mensaje in errores:
            flash(mensaje, "danger")
        return render_template("generar.html", anio=anio, mes=mes, empleados=empleados,
                               novedades={}, existe=existe_rol(conn, anio, mes)), 400

    rol_id = guardar_rol(conn, anio, mes, empleados, novedades)
    flash(f"Rol de {anio}-{mes:02d} generado para {len(empleados)} empleados.", "success")
    return redirect(url_for("roles.ver", rol_id=rol_id))


def existe_rol(conn, anio, mes):
    return conn.execute("SELECT 1 FROM roles_cabecera WHERE anio = ? AND mes = ?",
                        (anio, mes)).fetchone() is not None


def guardar_rol(conn, anio, mes, empleados, novedades):
    """Calcula y persiste todo en una sola transacción; reemplaza el rol del mes si existía."""
    calculos = []
    for e in empleados:
        nov = novedades[e["id"]]
        resultado = calcular_rol(
            e["sueldo_base"], date.fromisoformat(e["fecha_ingreso"]), anio, mes,
            horas_50=nov["horas_50"], horas_100=nov["horas_100"],
            horas_nocturnas=nov["horas_nocturnas"], comisiones=nov["comisiones"],
            otros_descuentos=nov["otros_descuentos"])
        calculos.append((e, resultado.a_dict()))

    def total(campo):
        return float(sum((r[campo] for _, r in calculos), Decimal(0)))

    with conn:
        conn.execute("DELETE FROM roles_cabecera WHERE anio = ? AND mes = ?", (anio, mes))
        rol_id = conn.execute(
            "INSERT INTO roles_cabecera (anio, mes, generado_en, num_empleados, total_ingresos,"
            " total_descuentos, total_neto, total_provisiones, total_costo)"
            " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (anio, mes, datetime.now().isoformat(timespec="seconds"), len(calculos),
             total("total_ingresos"), total("total_descuentos"), total("neto_pagar"),
             total("total_provisiones"), total("costo_empleador"))).lastrowid

        for e, r in calculos:
            fila = {"rol_id": rol_id, "empleado_id": e["id"], "cedula": e["cedula"],
                    "nombres": e["nombres"], "cargo": e["cargo"],
                    "sueldo_base": e["sueldo_base"], "fecha_ingreso": e["fecha_ingreso"],
                    **{k: float(v) for k, v in r.items()}}
            columnas = ", ".join(fila)
            marcas = ", ".join("?" for _ in fila)
            conn.execute(f"INSERT INTO roles_detalle ({columnas}) VALUES ({marcas})",
                         tuple(fila.values()))

            nov = novedades[e["id"]]
            conn.execute(
                "INSERT OR REPLACE INTO novedades (empleado_id, anio, mes, horas_50, horas_100,"
                " horas_nocturnas, comisiones, otros_descuentos) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                (e["id"], anio, mes, *(float(nov[c]) for c in CAMPOS_NOVEDAD.values())))
    return rol_id


def cargar_rol(rol_id):
    conn = db.get_db()
    cabecera = conn.execute("SELECT * FROM roles_cabecera WHERE id = ?", (rol_id,)).fetchone()
    if cabecera is None:
        abort(404)
    detalle = conn.execute(
        "SELECT * FROM roles_detalle WHERE rol_id = ? ORDER BY nombres", (rol_id,)).fetchall()
    return cabecera, detalle


@bp.get("/<int:rol_id>")
def ver(rol_id):
    cabecera, detalle = cargar_rol(rol_id)
    return render_template("rol.html", rol=cabecera, detalle=detalle)


@bp.get("/<int:rol_id>/empleado/<int:det_id>")
def boleta(rol_id, det_id):
    cabecera, detalle = cargar_rol(rol_id)
    fila = next((d for d in detalle if d["id"] == det_id), None)
    if fila is None:
        abort(404)
    return render_template("boleta.html", rol=cabecera, d=fila)


@bp.get("/<int:rol_id>.csv")
def exportar(rol_id):
    cabecera, detalle = cargar_rol(rol_id)
    salida = io.StringIO()
    escritor = csv.writer(salida)
    columnas = ["cedula", "nombres", "cargo", "sueldo", "valor_horas_50", "valor_horas_100",
                "valor_recargo_nocturno", "comisiones", "total_ingresos", "aporte_iess",
                "impuesto_renta", "otros_descuentos", "total_descuentos", "neto_pagar",
                "decimo_tercero", "decimo_cuarto", "vacaciones", "fondos_reserva",
                "aporte_patronal", "costo_empleador"]
    escritor.writerow(columnas)
    for d in detalle:
        escritor.writerow([d[c] for c in columnas])
    nombre = f"rol_{cabecera['anio']}_{cabecera['mes']:02d}.csv"
    return Response("﻿" + salida.getvalue(), mimetype="text/csv",
                    headers={"Content-Disposition": f"attachment; filename={nombre}"})


@bp.post("/<int:rol_id>/eliminar")
def eliminar(rol_id):
    conn = db.get_db()
    with conn:
        conn.execute("DELETE FROM roles_cabecera WHERE id = ?", (rol_id,))
    flash("Rol eliminado.", "info")
    return redirect(url_for("roles.lista"))
