"""Rol de Pagos Ecuador: módulo demostrativo (Flask + SQLite).

Ejecutar:  python app.py   ->  http://127.0.0.1:5000
"""
import sqlite3
from pathlib import Path

from flask import Flask, flash, redirect, render_template, request, url_for

import db
from roles import bp as roles_bp
from validaciones import a_decimal, a_fecha, cedula_valida

MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
         "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]
CONTRATOS = ["Indefinido", "Plazo fijo", "Eventual", "Ocasional", "Obra o servicio"]

EMPRESA = {"nombre": "Empresa Demo S.A.", "ruc": "1790000000001"}  # editar para el taller

EMPLEADOS_DEMO = [
    ("1801234566", "María Fernanda Paredes", "Gerente General", 4500, "2019-03-01", "Indefinido"),
    ("1702345677", "Carlos Andrés Villacís", "Contador", 1800, "2022-07-15", "Indefinido"),
    ("0903456788", "Lucía Estefanía Mora", "Asistente Administrativa", 650, "2024-02-01", "Plazo fijo"),
    ("0104567896", "José Luis Camacho", "Vendedor", 900, "2025-11-03", "Indefinido"),
    ("1715678908", "Daniela Alejandra Ruiz", "Analista de Sistemas", 2600, "2023-05-10", "Indefinido"),
    ("0606789014", "Pedro Pablo Guamán", "Bodeguero", 482, "2026-10-16", "Eventual"),
]


def create_app(config=None):
    app = Flask(__name__)
    app.config["SECRET_KEY"] = "taller-rol-pagos"  # solo demo: sin sesiones sensibles
    app.config["DATABASE"] = str(Path(app.root_path) / "rol_pagos.db")
    if config:
        app.config.update(config)
    db.init_app(app)
    app.register_blueprint(roles_bp)

    @app.template_filter("money")
    def money(valor):
        return f"${(valor or 0):,.2f}"

    @app.context_processor
    def globales():
        return {"MESES": MESES, "CONTRATOS": CONTRATOS, "EMPRESA": EMPRESA}

    # --- Empleados ---------------------------------------------------------
    @app.get("/")
    def inicio():
        return redirect(url_for("empleados"))

    @app.get("/empleados")
    def empleados():
        filas = db.get_db().execute(
            "SELECT * FROM empleados ORDER BY activo DESC, nombres").fetchall()
        return render_template("empleados.html", empleados=filas)

    @app.route("/empleados/nuevo", methods=["GET", "POST"])
    def empleado_nuevo():
        return guardar_empleado(None)

    @app.route("/empleados/<int:emp_id>/editar", methods=["GET", "POST"])
    def empleado_editar(emp_id):
        fila = db.get_db().execute(
            "SELECT * FROM empleados WHERE id = ?", (emp_id,)).fetchone()
        if fila is None:
            flash("El empleado no existe.", "danger")
            return redirect(url_for("empleados"))
        return guardar_empleado(fila)

    def guardar_empleado(actual):
        if request.method == "GET":
            return render_template("empleado_form.html", e=actual or {})

        form = request.form
        datos = {k: form.get(k, "").strip() for k in
                 ("cedula", "nombres", "cargo", "sueldo_base", "fecha_ingreso", "tipo_contrato")}
        errores = []
        if not cedula_valida(datos["cedula"]):
            errores.append("La cédula no es válida (10 dígitos, módulo 10).")
        if not datos["nombres"] or not datos["cargo"]:
            errores.append("Nombres y cargo son obligatorios.")
        if datos["tipo_contrato"] not in CONTRATOS:
            errores.append("Tipo de contrato inválido.")
        try:
            sueldo = a_decimal(datos["sueldo_base"])
            if sueldo <= 0:
                errores.append("El sueldo base debe ser mayor a cero.")
            elif sueldo < 482:
                flash("Aviso: el sueldo es menor al SBU 2026 ($482).", "warning")
        except ValueError as exc:
            sueldo = None
            errores.append(f"Sueldo base: {exc}.")
        try:
            a_fecha(datos["fecha_ingreso"])
        except ValueError as exc:
            errores.append(f"Fecha de ingreso: {exc}.")

        if errores:
            for mensaje in errores:
                flash(mensaje, "danger")
            return render_template("empleado_form.html", e=datos), 400

        conn = db.get_db()
        valores = (datos["cedula"], datos["nombres"], datos["cargo"], float(sueldo),
                   datos["fecha_ingreso"], datos["tipo_contrato"])
        try:
            if actual is None:
                conn.execute(
                    "INSERT INTO empleados (cedula, nombres, cargo, sueldo_base, fecha_ingreso,"
                    " tipo_contrato) VALUES (?, ?, ?, ?, ?, ?)", valores)
            else:
                conn.execute(
                    "UPDATE empleados SET cedula=?, nombres=?, cargo=?, sueldo_base=?,"
                    " fecha_ingreso=?, tipo_contrato=? WHERE id=?", (*valores, actual["id"]))
            conn.commit()
        except sqlite3.IntegrityError:
            flash("Ya existe un empleado con esa cédula.", "danger")
            return render_template("empleado_form.html", e=datos), 400
        flash("Empleado guardado.", "success")
        return redirect(url_for("empleados"))

    @app.post("/empleados/<int:emp_id>/estado")
    def empleado_estado(emp_id):
        conn = db.get_db()
        conn.execute("UPDATE empleados SET activo = 1 - activo WHERE id = ?", (emp_id,))
        conn.commit()
        return redirect(url_for("empleados"))

    @app.post("/empleados/<int:emp_id>/eliminar")
    def empleado_eliminar(emp_id):
        conn = db.get_db()
        conn.execute("DELETE FROM empleados WHERE id = ?", (emp_id,))
        conn.commit()
        flash("Empleado eliminado. Los roles ya generados se conservan.", "info")
        return redirect(url_for("empleados"))

    @app.post("/empleados/demo")
    def empleados_demo():
        conn = db.get_db()
        conn.executemany(
            "INSERT OR IGNORE INTO empleados (cedula, nombres, cargo, sueldo_base,"
            " fecha_ingreso, tipo_contrato) VALUES (?, ?, ?, ?, ?, ?)", EMPLEADOS_DEMO)
        conn.commit()
        flash("Se cargaron los empleados de ejemplo.", "success")
        return redirect(url_for("empleados"))

    return app


if __name__ == "__main__":
    create_app().run(debug=True)
