"""Motor de cálculo del rol de pagos (Ecuador 2026).

Funciones puras: no tocan la base de datos ni Flask. Todo el dinero se maneja
con Decimal y se redondea a centavos (ROUND_HALF_UP) en cada rubro, para que
las columnas del rol sumen exactamente el total que se muestra.
"""
from dataclasses import asdict, dataclass
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

D = Decimal

# --- Parámetros de ley 2026 -------------------------------------------------
SBU = D("482")                  # Salario Básico Unificado 2026
IESS_PERSONAL = D("0.0945")     # aporte del trabajador
IESS_PATRONAL = D("0.1115")     # aporte del empleador
FONDOS_RESERVA = D("0.0833")    # 8.33% desde el mes 13
HORAS_MES = D("240")            # 30 días x 8 horas: base del valor hora
DIAS_MES = D("30")              # mes comercial laboral

# Multiplicador sobre el valor hora, según Código del Trabajo (art. 55 y 49)
RECARGO_50 = D("1.5")           # suplementarias (hasta 4 h diarias)
RECARGO_100 = D("2.0")          # extraordinarias: sábados, domingos, feriados
RECARGO_NOCTURNO = D("0.25")    # solo el recargo: la hora base ya está en el sueldo

# Tabla SRI 2026, personas naturales (Res. NAC-DGERCGC25-00000043).
# (límite inferior, límite superior, impuesto fracción básica, % excedente)
TABLA_IR_2026 = [
    (D("0"), D("12208"), D("0"), D("0.00")),
    (D("12208"), D("15549"), D("0"), D("0.05")),
    (D("15549"), D("20188"), D("167"), D("0.10")),
    (D("20188"), D("26700"), D("631"), D("0.12")),
    (D("26700"), D("35136"), D("1412"), D("0.15")),
    (D("35136"), D("46575"), D("2678"), D("0.20")),
    (D("46575"), D("62005"), D("4965"), D("0.25")),
    (D("62005"), D("82679"), D("8823"), D("0.30")),
    (D("82679"), D("109956"), D("15025"), D("0.35")),
    (D("109956"), None, D("24572"), D("0.37")),
]


def q(valor) -> Decimal:
    """Redondea a centavos."""
    return D(valor).quantize(D("0.01"), rounding=ROUND_HALF_UP)


def impuesto_renta_anual(base_anual) -> Decimal:
    """Aplica la tabla progresiva: cuota fija del tramo + % sobre el excedente."""
    base = D(base_anual)
    if base <= 0:
        return D("0.00")
    for inferior, superior, cuota, porcentaje in TABLA_IR_2026:
        if superior is None or base <= superior:
            return q(cuota + (base - inferior) * porcentaje)
    raise AssertionError("la tabla debe cubrir todos los valores")  # pragma: no cover


def retencion_ir_mensual(ingresos_gravados, aporte_iess) -> dict:
    """Proyecta el año (x12), resta el IESS (deducible) y reparte el IR en 12 cuotas."""
    base_anual = max(D("0"), (D(ingresos_gravados) - D(aporte_iess)) * 12)
    anual = impuesto_renta_anual(base_anual)
    return {"base_anual": q(base_anual), "ir_anual": anual, "ir_mensual": q(anual / 12)}


def meses_de_servicio(fecha_ingreso: date, anio: int, mes: int) -> int:
    """Meses calendario transcurridos entre el mes de ingreso y el período."""
    return (anio - fecha_ingreso.year) * 12 + (mes - fecha_ingreso.month)


def dias_trabajados(fecha_ingreso: date, anio: int, mes: int) -> int:
    """30 días, salvo el mes de ingreso, que se prorratea desde el día de ingreso."""
    if (fecha_ingreso.year, fecha_ingreso.month) == (anio, mes):
        return max(1, min(30, 30 - fecha_ingreso.day + 1))
    return 30


@dataclass
class ResultadoRol:
    # contexto
    dias_trabajados: int
    meses_servicio: int
    valor_hora: Decimal
    # ingresos
    sueldo: Decimal
    horas_50: Decimal
    horas_100: Decimal
    horas_nocturnas: Decimal
    valor_horas_50: Decimal
    valor_horas_100: Decimal
    valor_recargo_nocturno: Decimal
    comisiones: Decimal
    total_ingresos: Decimal
    # descuentos
    aporte_iess: Decimal
    base_ir_anual: Decimal
    ir_anual: Decimal
    impuesto_renta: Decimal
    otros_descuentos: Decimal
    total_descuentos: Decimal
    # neto
    neto_pagar: Decimal
    # provisiones y costo empleador (no afectan el neto)
    decimo_tercero: Decimal
    decimo_cuarto: Decimal
    vacaciones: Decimal
    fondos_reserva: Decimal
    aporte_patronal: Decimal
    total_provisiones: Decimal
    costo_empleador: Decimal

    def a_dict(self) -> dict:
        return asdict(self)


def calcular_rol(
    sueldo_base,
    fecha_ingreso: date,
    anio: int,
    mes: int,
    horas_50=0,
    horas_100=0,
    horas_nocturnas=0,
    comisiones=0,
    otros_descuentos=0,
) -> ResultadoRol:
    sueldo_base = D(sueldo_base)
    horas_50, horas_100, horas_nocturnas = D(horas_50), D(horas_100), D(horas_nocturnas)
    comisiones, otros_descuentos = q(comisiones), q(otros_descuentos)

    dias = dias_trabajados(fecha_ingreso, anio, mes)
    meses = meses_de_servicio(fecha_ingreso, anio, mes)

    # Ingresos. El valor hora sale del sueldo completo, aunque el mes se prorratee.
    valor_hora = sueldo_base / HORAS_MES
    sueldo = q(sueldo_base * dias / DIAS_MES)
    v50 = q(horas_50 * valor_hora * RECARGO_50)
    v100 = q(horas_100 * valor_hora * RECARGO_100)
    vnoc = q(horas_nocturnas * valor_hora * RECARGO_NOCTURNO)
    total_ingresos = sueldo + v50 + v100 + vnoc + comisiones

    # Descuentos. Todo el ingreso aquí es gravado con IESS.
    iess = q(total_ingresos * IESS_PERSONAL)
    ir = retencion_ir_mensual(total_ingresos, iess)
    total_descuentos = iess + ir["ir_mensual"] + otros_descuentos
    neto = total_ingresos - total_descuentos

    # Provisiones del empleador: se muestran, no se descuentan.
    decimo_tercero = q(total_ingresos / 12)
    decimo_cuarto = q(SBU / 12 * dias / DIAS_MES)  # siempre sobre el SBU, no el sueldo
    vacaciones = q(sueldo / 24)
    fondos = q(total_ingresos * FONDOS_RESERVA) if meses >= 12 else D("0.00")
    patronal = q(total_ingresos * IESS_PATRONAL)
    provisiones = decimo_tercero + decimo_cuarto + vacaciones + fondos + patronal

    return ResultadoRol(
        dias_trabajados=dias,
        meses_servicio=meses,
        valor_hora=q(valor_hora),
        sueldo=sueldo,
        horas_50=horas_50,
        horas_100=horas_100,
        horas_nocturnas=horas_nocturnas,
        valor_horas_50=v50,
        valor_horas_100=v100,
        valor_recargo_nocturno=vnoc,
        comisiones=comisiones,
        total_ingresos=total_ingresos,
        aporte_iess=iess,
        base_ir_anual=ir["base_anual"],
        ir_anual=ir["ir_anual"],
        impuesto_renta=ir["ir_mensual"],
        otros_descuentos=otros_descuentos,
        total_descuentos=total_descuentos,
        neto_pagar=neto,
        decimo_tercero=decimo_tercero,
        decimo_cuarto=decimo_cuarto,
        vacaciones=vacaciones,
        fondos_reserva=fondos,
        aporte_patronal=patronal,
        total_provisiones=provisiones,
        costo_empleador=total_ingresos + provisiones,
    )
