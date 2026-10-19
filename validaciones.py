"""Validaciones de formulario: cédula ecuatoriana y números."""
from datetime import date
from decimal import Decimal, InvalidOperation


def cedula_valida(cedula: str) -> bool:
    """Algoritmo módulo 10 del Registro Civil (personas naturales)."""
    if len(cedula) != 10 or not cedula.isdigit():
        return False
    provincia = int(cedula[:2])
    if not (1 <= provincia <= 24 or provincia == 30) or int(cedula[2]) > 5:
        return False
    suma = 0
    for i, digito in enumerate(cedula[:9]):
        producto = int(digito) * (2 if i % 2 == 0 else 1)
        suma += producto - 9 if producto > 9 else producto
    return (10 - suma % 10) % 10 == int(cedula[9])


def a_decimal(texto, minimo=0):
    """Convierte texto del formulario a Decimal; vacío = 0. Lanza ValueError si es inválido."""
    texto = (texto or "").strip().replace(",", ".")
    if not texto:
        return Decimal(0)
    try:
        valor = Decimal(texto)
    except InvalidOperation:
        raise ValueError(f"'{texto}' no es un número") from None
    if not valor.is_finite() or valor < minimo:
        raise ValueError(f"El valor debe ser mayor o igual a {minimo}")
    return valor


def a_fecha(texto) -> date:
    try:
        return date.fromisoformat(texto)
    except (TypeError, ValueError):
        raise ValueError("Fecha inválida") from None
