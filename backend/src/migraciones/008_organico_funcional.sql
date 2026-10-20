-- Orgánico funcional: cada puesto dice qué función cumple, de qué responde, en qué sector económico
-- está y qué nivel de la escala salarial le sirve de referencia. El puesto se identifica ANTES de
-- asignar el sueldo: el nivel de la escala sale del puesto.
CREATE TABLE IF NOT EXISTS puestos (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre           TEXT    NOT NULL UNIQUE,
    superior_id      INTEGER REFERENCES puestos(id) ON DELETE SET NULL,
    funcion          TEXT    NOT NULL,
    responsabilidad  TEXT    NOT NULL,
    sector           TEXT    NOT NULL,
    escala_id        INTEGER REFERENCES escala_salarial(id) ON DELETE SET NULL
);

-- Orgánico de ejemplo: gerente/propietario -> administrador/contador -> tres puestos operativos.
-- El nivel de cada puesto es una propuesta sobre la tabla de clase (por confirmar), y el sector
-- económico queda por definir hasta saber la rama de la empresa.
INSERT OR IGNORE INTO puestos (id, nombre, superior_id, funcion, responsabilidad, sector, escala_id) VALUES
    (1, 'Gerente / Propietario', NULL,
        'Dirigir la empresa, fijar sus objetivos y representarla legalmente.',
        'Responde por los resultados, el cumplimiento de la ley y la aprobación de contratos y sueldos.',
        'Por definir',
        (SELECT id FROM escala_salarial WHERE regimen = 'CODIGO_TRABAJO' AND grado = 1)),
    (2, 'Administrador / Contador', 1,
        'Administrar los recursos de la empresa y llevar su contabilidad, tributos y rol de pagos.',
        'Responde ante el gerente por los registros contables y por pagar a tiempo el IESS, el SRI y los sueldos.',
        'Por definir',
        (SELECT id FROM escala_salarial WHERE regimen = 'CODIGO_TRABAJO' AND grado = 2)),
    (3, 'Supervisor de instalaciones', 2,
        'Coordinar y controlar el trabajo del personal de instalaciones.',
        'Responde ante el administrador por la calidad, los plazos y la seguridad de cada instalación.',
        'Por definir',
        (SELECT id FROM escala_salarial WHERE regimen = 'CODIGO_TRABAJO' AND grado = 4)),
    (4, 'Operaciones de instalaciones', 2,
        'Ejecutar en campo las instalaciones y su mantenimiento.',
        'Responde por la correcta ejecución del trabajo asignado y por el uso de los equipos.',
        'Por definir',
        (SELECT id FROM escala_salarial WHERE regimen = 'CODIGO_TRABAJO' AND grado = 6)),
    (5, 'Auxiliar de guardalmacén', 2,
        'Recibir, guardar y despachar los materiales y herramientas.',
        'Responde por el inventario y por el estado de lo que custodia.',
        'Por definir',
        (SELECT id FROM escala_salarial WHERE regimen = 'CODIGO_TRABAJO' AND grado = 11));

ALTER TABLE empleados ADD COLUMN puesto_id INTEGER REFERENCES puestos(id) ON DELETE SET NULL;
