-- Esquema mínimo: 3 tablas del enunciado + novedades (insumos manuales del mes).

CREATE TABLE IF NOT EXISTS empleados (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula        TEXT    NOT NULL UNIQUE,
    nombres       TEXT    NOT NULL,
    cargo         TEXT    NOT NULL,
    sueldo_base   REAL    NOT NULL CHECK (sueldo_base > 0),
    fecha_ingreso TEXT    NOT NULL,                 -- ISO: AAAA-MM-DD
    tipo_contrato TEXT    NOT NULL,
    activo        INTEGER NOT NULL DEFAULT 1
);

-- Horas extras, comisiones y descuentos que se digitan a mano cada mes.
CREATE TABLE IF NOT EXISTS novedades (
    empleado_id      INTEGER NOT NULL REFERENCES empleados(id) ON DELETE CASCADE,
    anio             INTEGER NOT NULL,
    mes              INTEGER NOT NULL,
    horas_50         REAL NOT NULL DEFAULT 0,
    horas_100        REAL NOT NULL DEFAULT 0,
    horas_nocturnas  REAL NOT NULL DEFAULT 0,
    comisiones       REAL NOT NULL DEFAULT 0,
    otros_descuentos REAL NOT NULL DEFAULT 0,
    PRIMARY KEY (empleado_id, anio, mes)
);

-- Un rol por mes; volver a generarlo lo reemplaza.
CREATE TABLE IF NOT EXISTS roles_cabecera (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    anio              INTEGER NOT NULL,
    mes               INTEGER NOT NULL,
    generado_en       TEXT    NOT NULL,
    num_empleados     INTEGER NOT NULL,
    total_ingresos    REAL    NOT NULL,
    total_descuentos  REAL    NOT NULL,
    total_neto        REAL    NOT NULL,
    total_provisiones REAL    NOT NULL,
    total_costo       REAL    NOT NULL,
    UNIQUE (anio, mes)
);

-- Una fila por empleado. Guarda una "foto" (cédula, nombre, cargo, sueldo) para que
-- el historial no cambie si luego se edita o elimina al empleado.
CREATE TABLE IF NOT EXISTS roles_detalle (
    id                     INTEGER PRIMARY KEY AUTOINCREMENT,
    rol_id                 INTEGER NOT NULL REFERENCES roles_cabecera(id) ON DELETE CASCADE,
    empleado_id            INTEGER,
    cedula                 TEXT NOT NULL,
    nombres                TEXT NOT NULL,
    cargo                  TEXT NOT NULL,
    sueldo_base            REAL NOT NULL,
    fecha_ingreso          TEXT NOT NULL,
    dias_trabajados        INTEGER NOT NULL,
    meses_servicio         INTEGER NOT NULL,
    valor_hora             REAL NOT NULL,
    -- ingresos
    sueldo                 REAL NOT NULL,
    horas_50               REAL NOT NULL,
    horas_100              REAL NOT NULL,
    horas_nocturnas        REAL NOT NULL,
    valor_horas_50         REAL NOT NULL,
    valor_horas_100        REAL NOT NULL,
    valor_recargo_nocturno REAL NOT NULL,
    comisiones             REAL NOT NULL,
    total_ingresos         REAL NOT NULL,
    -- descuentos
    aporte_iess            REAL NOT NULL,
    base_ir_anual          REAL NOT NULL,
    ir_anual               REAL NOT NULL,
    impuesto_renta         REAL NOT NULL,
    otros_descuentos       REAL NOT NULL,
    total_descuentos       REAL NOT NULL,
    neto_pagar             REAL NOT NULL,
    -- provisiones / costo empleador
    decimo_tercero         REAL NOT NULL,
    decimo_cuarto          REAL NOT NULL,
    vacaciones             REAL NOT NULL,
    fondos_reserva         REAL NOT NULL,
    aporte_patronal        REAL NOT NULL,
    total_provisiones      REAL NOT NULL,
    costo_empleador        REAL NOT NULL
);
