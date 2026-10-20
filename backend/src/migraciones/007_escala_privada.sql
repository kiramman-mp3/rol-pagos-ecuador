-- Escala del sector privado (Código del Trabajo): niveles ocupacionales cuyo valor es un MÍNIMO,
-- no una remuneración fija. El sueldo puede ser mayor, pero nunca menor al mínimo del nivel.
-- `es_minimo` distingue estos niveles de los grados de la LOSEP, donde el sueldo es exactamente la RMU.
-- `rmu_max` es solo referencia: el tope del rango de mínimos entre ramas económicas.
ALTER TABLE escala_salarial ADD COLUMN es_minimo INTEGER NOT NULL DEFAULT 0 CHECK (es_minimo IN (0, 1));
ALTER TABLE escala_salarial ADD COLUMN rmu_max REAL CHECK (rmu_max IS NULL OR rmu_max >= rmu);

-- Tabla entregada por el usuario (material de clase); no se pudo contrastar con el acuerdo del
-- Ministerio del Trabajo: está POR CONFIRMAR. El mínimo es el extremo inferior del rango.
INSERT OR IGNORE INTO escala_salarial (regimen, grado, denominacion, rmu, rmu_max, es_minimo, fuente) VALUES
    ('CODIGO_TRABAJO',  1, 'A: Jefatura',                510, 1280, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  2, 'B1: Supervisión general',    495,  842, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  3, 'B2: Supervisión técnica',    490,  650, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  4, 'B3: Supervisión operativa',  485,  580, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  5, 'C1: Operación especializada', 490, 740, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  6, 'C2: Operación técnica',      484,  510, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  7, 'C3: Operación básica',       482,  495, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  8, 'D1: Asistencia administrativa', 482, 500, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO',  9, 'D2: Asistencia técnica',     482,  490, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO', 10, 'E1: Soporte administrativo', 482, NULL, 1, 'Tabla de clase (por confirmar)'),
    ('CODIGO_TRABAJO', 11, 'E2: Soporte operativo',      482, NULL, 1, 'Tabla de clase (por confirmar)');
