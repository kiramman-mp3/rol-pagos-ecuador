from datetime import date
from decimal import Decimal as D

import pytest

from calculos import (
    calcular_rol,
    dias_trabajados,
    impuesto_renta_anual,
    meses_de_servicio,
)

ANTIGUO = date(2020, 1, 15)


@pytest.mark.parametrize(
    "base, esperado",
    [
        (0, "0.00"),
        (12208, "0.00"),          # fracción básica exenta
        (15549, "167.05"),        # fin del tramo 5%: 3341 * 5%
        (21732, "816.28"),        # 631 + (21732-20188) * 12%
        (30000, "1907.00"),       # 1412 + (30000-26700) * 15%
        (120000, "28288.28"),     # 24572 + (120000-109956) * 37%
    ],
)
def test_impuesto_renta_anual(base, esperado):
    assert impuesto_renta_anual(base) == D(esperado)


def test_sueldo_bajo_no_paga_ir():
    r = calcular_rol(482, ANTIGUO, 2026, 10)
    assert r.aporte_iess == D("45.55")
    assert r.impuesto_renta == D("0.00")
    assert r.neto_pagar == D("436.45")


def test_rol_completo_sueldo_2000():
    r = calcular_rol(2000, ANTIGUO, 2026, 10)
    assert r.total_ingresos == D("2000.00")
    assert r.aporte_iess == D("189.00")           # 9.45%
    assert r.base_ir_anual == D("21732.00")       # (2000-189)*12
    assert r.impuesto_renta == D("68.02")         # 816.28 / 12
    assert r.neto_pagar == D("1742.98")
    assert r.decimo_tercero == D("166.67")
    assert r.decimo_cuarto == D("40.17")          # SBU/12, no el sueldo
    assert r.vacaciones == D("83.33")
    assert r.fondos_reserva == D("166.60")        # 8.33%
    assert r.aporte_patronal == D("223.00")       # 11.15%
    assert r.costo_empleador == D(2000) + r.total_provisiones


def test_provisiones_no_afectan_el_neto():
    r = calcular_rol(1500, ANTIGUO, 2026, 10)
    assert r.neto_pagar == r.total_ingresos - r.total_descuentos


def test_horas_extras_y_comisiones():
    # valor hora = 960 / 240 = 4.00
    r = calcular_rol(960, ANTIGUO, 2026, 10, horas_50=10, horas_100=5,
                     horas_nocturnas=20, comisiones=100)
    assert r.valor_horas_50 == D("60.00")          # 10 * 4 * 1.5
    assert r.valor_horas_100 == D("40.00")         # 5 * 4 * 2
    assert r.valor_recargo_nocturno == D("20.00")  # 20 * 4 * 0.25
    assert r.total_ingresos == D("1180.00")
    assert r.aporte_iess == D("111.51")            # 1180 * 9.45%, redondeado


def test_otros_descuentos_reducen_el_neto():
    sin = calcular_rol(1000, ANTIGUO, 2026, 10)
    con = calcular_rol(1000, ANTIGUO, 2026, 10, otros_descuentos=50)
    assert sin.neto_pagar - con.neto_pagar == D("50.00")


def test_fondos_de_reserva_desde_el_mes_13():
    ingreso = date(2025, 10, 1)
    assert calcular_rol(1000, ingreso, 2026, 9).fondos_reserva == D("0.00")   # mes 12
    assert calcular_rol(1000, ingreso, 2026, 10).fondos_reserva == D("83.30")  # mes 13


def test_mes_de_ingreso_se_prorratea():
    assert dias_trabajados(date(2026, 10, 16), 2026, 10) == 15
    assert dias_trabajados(date(2026, 10, 1), 2026, 10) == 30
    assert dias_trabajados(date(2026, 10, 31), 2026, 10) == 1
    assert dias_trabajados(date(2026, 10, 16), 2026, 11) == 30
    r = calcular_rol(1000, date(2026, 10, 16), 2026, 10)
    assert r.sueldo == D("500.00")
    assert r.decimo_cuarto == D("20.08")           # prorrateado también


def test_meses_de_servicio():
    assert meses_de_servicio(date(2025, 10, 20), 2026, 10) == 12
    assert meses_de_servicio(date(2026, 10, 1), 2026, 10) == 0
