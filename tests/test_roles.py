import db


def generar(client, anio=2026, mes=10, **extra):
    return client.post("/roles/generar", data={"anio": anio, "mes": mes, **extra},
                       follow_redirects=True)


def cargar_demo(client):
    client.post("/empleados/demo")


def filas(client, sql, params=()):
    with client.application.app_context():
        return [dict(f) for f in db.get_db().execute(sql, params).fetchall()]


def test_generar_procesa_a_todos_los_activos(client):
    cargar_demo(client)
    client.post("/empleados/2/estado")            # un inactivo no entra al rol
    r = generar(client)
    assert r.status_code == 200 and "Neto a pagar a 5 empleados" in r.text
    cab = filas(client, "SELECT * FROM roles_cabecera")[0]
    assert cab["num_empleados"] == 5


def test_totales_de_cabecera_cuadran_con_el_detalle(client):
    cargar_demo(client)
    generar(client)
    cab = filas(client, "SELECT * FROM roles_cabecera")[0]
    det = filas(client, "SELECT * FROM roles_detalle")
    assert round(sum(d["neto_pagar"] for d in det), 2) == cab["total_neto"]
    assert round(sum(d["total_ingresos"] for d in det), 2) == cab["total_ingresos"]
    for d in det:
        assert round(d["total_ingresos"] - d["total_descuentos"], 2) == d["neto_pagar"]
        assert round(d["total_ingresos"] + d["total_provisiones"], 2) == d["costo_empleador"]


def test_novedades_se_aplican_y_se_recuerdan(client):
    cargar_demo(client)
    # empleado 2 (Carlos, $1800): 10 h al 50% -> valor hora 7.5 -> 112.50
    generar(client, h50_2="10", com_2="200", desc_2="30")
    d = filas(client, "SELECT * FROM roles_detalle WHERE empleado_id = 2")[0]
    assert d["valor_horas_50"] == 112.5
    assert d["total_ingresos"] == 2112.5
    assert d["otros_descuentos"] == 30
    html = client.get("/roles/generar?anio=2026&mes=10").text
    assert 'name="com_2" value="200"' in html and "reemplazará" in html


def test_regenerar_reemplaza_el_rol_del_mes(client):
    cargar_demo(client)
    generar(client)
    generar(client, com_1="500")
    assert len(filas(client, "SELECT * FROM roles_cabecera")) == 1
    assert len(filas(client, "SELECT * FROM roles_detalle")) == 6


def test_empleado_con_ingreso_posterior_no_entra(client):
    cargar_demo(client)
    generar(client, anio=2026, mes=9)            # Pedro ingresa el 2026-10-16
    assert filas(client, "SELECT * FROM roles_cabecera")[0]["num_empleados"] == 5


def test_historial_sobrevive_a_eliminar_empleado(client):
    cargar_demo(client)
    generar(client)
    client.post("/empleados/1/eliminar")
    det = filas(client, "SELECT * FROM roles_detalle WHERE nombres LIKE 'María%'")
    assert len(det) == 1 and det[0]["empleado_id"] == 1


def test_novedad_invalida_no_genera_nada(client):
    cargar_demo(client)
    r = generar(client, h50_1="abc")
    assert r.status_code == 400
    assert filas(client, "SELECT * FROM roles_cabecera") == []


def test_vistas_boleta_csv_y_eliminar(client):
    cargar_demo(client)
    generar(client)
    assert client.get("/roles").status_code == 200
    det_id = filas(client, "SELECT id FROM roles_detalle")[0]["id"]
    assert "Neto a recibir" in client.get(f"/roles/1/empleado/{det_id}").text
    csv = client.get("/roles/1.csv")
    assert csv.mimetype == "text/csv" and "neto_pagar" in csv.text
    assert client.get("/roles/99").status_code == 404
    client.post("/roles/1/eliminar")
    assert filas(client, "SELECT * FROM roles_detalle") == []   # cascada


def test_periodo_invalido(client):
    assert client.get("/roles/generar?anio=1900&mes=13").status_code == 400


def test_sin_empleados_redirige(client):
    r = client.get("/roles/generar?anio=2026&mes=10", follow_redirects=True)
    assert "No hay empleados activos" in r.text
