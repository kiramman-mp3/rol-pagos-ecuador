import pytest

from validaciones import a_decimal, cedula_valida


def test_cedula_valida():
    assert cedula_valida("1801234566")
    assert not cedula_valida("1801234567")   # dígito verificador incorrecto
    assert not cedula_valida("9901234566")   # provincia inexistente
    assert not cedula_valida("18012345")     # longitud
    assert not cedula_valida("18012A4566")   # no numérica


def test_a_decimal():
    assert a_decimal("12,5") == a_decimal("12.5")
    assert a_decimal("") == 0
    with pytest.raises(ValueError):
        a_decimal("abc")
    with pytest.raises(ValueError):
        a_decimal("-1")
    with pytest.raises(ValueError):
        a_decimal("NaN")


def test_crear_listar_editar_eliminar(client, empleado_form):
    r = client.post("/empleados/nuevo", data=empleado_form, follow_redirects=True)
    assert r.status_code == 200 and "Ana Prueba" in r.text

    empleado_form["cargo"] = "Jefe de área"
    client.post("/empleados/1/editar", data=empleado_form)
    assert "Jefe de área" in client.get("/empleados").text

    client.post("/empleados/1/estado")
    assert "Inactivo" in client.get("/empleados").text

    client.post("/empleados/1/eliminar")
    assert "Ana Prueba" not in client.get("/empleados").text


def test_rechaza_cedula_invalida_y_duplicada(client, empleado_form):
    malo = {**empleado_form, "cedula": "1801234560"}
    assert client.post("/empleados/nuevo", data=malo).status_code == 400

    client.post("/empleados/nuevo", data=empleado_form)
    assert client.post("/empleados/nuevo", data=empleado_form).status_code == 400


def test_datos_demo_son_validos_y_no_se_duplican(client):
    client.post("/empleados/demo")
    client.post("/empleados/demo")
    html = client.get("/empleados").text
    assert html.count("estado-activo") == 6
