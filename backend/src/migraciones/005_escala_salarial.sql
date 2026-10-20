-- Escala salarial: grados con la remuneración mensual unificada (RMU) de cada uno.
-- Cada escala pertenece a un régimen con reglas propias; los empleados de la LOEP
-- que son servidores usan la escala de la LOSEP.
CREATE TABLE IF NOT EXISTS escala_salarial (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    regimen      TEXT    NOT NULL,
    grado        INTEGER NOT NULL CHECK (grado > 0),
    denominacion TEXT    NOT NULL,
    rmu          REAL    NOT NULL CHECK (rmu > 0),
    fuente       TEXT    NOT NULL DEFAULT '',
    UNIQUE (regimen, grado)
);

-- Escala de ejemplo del sector público (LOSEP). La toma de ecu11.com, que lista 22 grados aunque
-- dice que son 20 y no cita el acuerdo ministerial: está POR CONFIRMAR con el Ministerio del Trabajo.
INSERT OR IGNORE INTO escala_salarial (regimen, grado, denominacion, rmu, fuente) VALUES
    ('LOSEP',  1, 'Servidor Público de Servicios 1',  527, 'ecu11.com (por confirmar)'),
    ('LOSEP',  2, 'Servidor Público de Servicios 2',  553, 'ecu11.com (por confirmar)'),
    ('LOSEP',  3, 'Servidor Público de Apoyo 1',      585, 'ecu11.com (por confirmar)'),
    ('LOSEP',  4, 'Servidor Público de Apoyo 2',      622, 'ecu11.com (por confirmar)'),
    ('LOSEP',  5, 'Servidor Público de Apoyo 3',      675, 'ecu11.com (por confirmar)'),
    ('LOSEP',  6, 'Servidor Público de Apoyo 4',      733, 'ecu11.com (por confirmar)'),
    ('LOSEP',  7, 'Servidor Público 1',               817, 'ecu11.com (por confirmar)'),
    ('LOSEP',  8, 'Servidor Público 2',               901, 'ecu11.com (por confirmar)'),
    ('LOSEP',  9, 'Servidor Público 3',               986, 'ecu11.com (por confirmar)'),
    ('LOSEP', 10, 'Servidor Público 4',              1086, 'ecu11.com (por confirmar)'),
    ('LOSEP', 11, 'Servidor Público 5',              1212, 'ecu11.com (por confirmar)'),
    ('LOSEP', 12, 'Servidor Público 6',              1412, 'ecu11.com (por confirmar)'),
    ('LOSEP', 13, 'Servidor Público 7',              1676, 'ecu11.com (por confirmar)'),
    ('LOSEP', 14, 'Servidor Público 8',              1760, 'ecu11.com (por confirmar)'),
    ('LOSEP', 15, 'Servidor Público 9',              2034, 'ecu11.com (por confirmar)'),
    ('LOSEP', 16, 'Servidor Público 10',             2308, 'ecu11.com (por confirmar)'),
    ('LOSEP', 17, 'Servidor Público 11',             2358, 'ecu11.com (por confirmar)'),
    ('LOSEP', 18, 'Servidor Público 12',             2408, 'ecu11.com (por confirmar)'),
    ('LOSEP', 19, 'Servidor Público 13',             2670, 'ecu11.com (por confirmar)'),
    ('LOSEP', 20, 'Servidor Público 14',             3188, 'ecu11.com (por confirmar)'),
    ('LOSEP', 21, 'Servidor Público 15',             3848, 'ecu11.com (por confirmar)'),
    ('LOSEP', 22, 'Servidor Público 16',             4500, 'ecu11.com (por confirmar)');

-- Grado de la escala al que pertenece el empleado (opcional). Si se borra el grado, el
-- empleado conserva su sueldo y solo pierde el vínculo.
ALTER TABLE empleados ADD COLUMN escala_id INTEGER REFERENCES escala_salarial(id) ON DELETE SET NULL;
