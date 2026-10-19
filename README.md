# Rol de Pagos Ecuador 2026

Módulo demostrativo de nómina para un ERP simplificado. Flask + SQLite + Bootstrap, sin Docker ni build.

## Ejecutar

```bash
pip install -r requirements.txt
python app.py
```

Abrir http://127.0.0.1:5000, pulsar **Cargar datos de ejemplo** y luego **Roles de pago → Generar**.
La base `rol_pagos.db` se crea sola al arrancar (borrarla reinicia todo).

## Flujo

1. **Empleados**: alta con cédula validada (módulo 10), cargo, sueldo, ingreso y contrato.
2. **Roles de pago**: elegir mes/año.
3. **Novedades**: horas extras, comisiones y anticipos del mes (opcionales).
4. **Generar**: `calculos.calcular_rol()` procesa a cada empleado activo y guarda una foto en `roles_detalle`.
5. **Rol**: tabla de ingresos / descuentos / neto + tabla aparte de costo empleador y provisiones.
6. **Boleta individual** imprimible y **exportación CSV**.

## Estructura

| Archivo | Rol |
|---|---|
| `calculos.py` | Reglas de negocio (funciones puras, `Decimal`). Empezar a leer aquí. |
| `app.py` / `roles.py` | Rutas de empleados y de roles |
| `schema.sql` / `db.py` | 4 tablas y conexión SQLite |
| `validaciones.py` | Cédula y conversión de números |
| `templates/`, `static/` | Vistas (Bootstrap incluido localmente, funciona sin internet) |
| `tests/` | `pytest` |

## Reglas de cálculo

| Concepto | Regla |
|---|---|
| Valor hora | sueldo ÷ 240 |
| Horas suplementarias | hora × 1.5 |
| Horas extraordinarias (sáb., dom., feriados) | hora × 2 |
| Horas nocturnas | solo el recargo del 25% |
| Aporte personal IESS | 9.45% de los ingresos |
| Impuesto a la renta | `(ingresos − IESS) × 12` → tabla SRI 2026 (exento hasta $12,208) → ÷ 12 |
| Décimo tercero | total ingresos ÷ 12 |
| Décimo cuarto | SBU $482 ÷ 12 |
| Vacaciones | sueldo ÷ 24 |
| Fondos de reserva | 8.33% desde el mes 13 |
| Aporte patronal | 11.15% |
| Mes de ingreso | sueldo y décimo cuarto proporcionales a los días (base 30) |

Las provisiones **no** afectan el neto. Costo empleador = ingresos + provisiones.

### Simplificaciones declaradas

- Sin gastos personales deducibles ni rebajas del IR.
- Sin liquidación de décimos mensualizados ni fondos de reserva mensualizados.
- Sin cálculo de préstamos IESS, vacaciones gozadas ni liquidaciones por salida.
- Una sola empresa; nombre y RUC en la constante `EMPRESA` de `app.py`.
- Valores en `REAL` de SQLite, calculados con `Decimal` y redondeados a centavos antes de guardar.

## Desarrollo

```bash
pip install -r requirements-dev.txt
python -m pytest
python -m ruff check .
```

Fuentes de la tabla IR 2026 y del SBU: resolución SRI NAC-DGERCGC25-00000043 y publicaciones del MDT (SBU $482).
Verificar con el SRI antes de usar en producción.
