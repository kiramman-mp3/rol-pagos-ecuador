-- Régimen laboral: cada empleado se rige por uno, y cada régimen trae sus propias reglas.
-- Los porcentajes se guardan como fracción (0.0945 = 9.45%).
CREATE TABLE IF NOT EXISTS regimenes (
    codigo                  TEXT PRIMARY KEY,
    nombre                  TEXT NOT NULL,
    descripcion             TEXT NOT NULL DEFAULT '',
    base_legal              TEXT NOT NULL DEFAULT '',
    -- 'reglas': tiene sus propias tasas. 'mixto': remite a otros regímenes según la categoría del
    -- empleado (la LOEP: servidores de carrera como LOSEP, obreros como Código del Trabajo).
    tipo                    TEXT NOT NULL CHECK (tipo IN ('reglas', 'mixto')),
    regimen_servidor        TEXT,
    regimen_obrero          TEXT,
    iess_personal           DOUBLE PRECISION,
    iess_patronal           DOUBLE PRECISION,
    recargo_suplementarias  DOUBLE PRECISION,
    recargo_extraordinarias DOUBLE PRECISION,
    recargo_descanso        DOUBLE PRECISION,
    recargo_nocturno        DOUBLE PRECISION,
    tope_suplementarias_mes DOUBLE PRECISION,    -- NULL = sin tope mensual
    tope_extraordinarias_mes DOUBLE PRECISION,
    dias_vacaciones         INTEGER,
    fondos_reserva          DOUBLE PRECISION,
    meses_para_fondos       INTEGER,
    aplica_decimo_tercero   INTEGER NOT NULL DEFAULT 1,
    aplica_decimo_cuarto    INTEGER NOT NULL DEFAULT 1,
    aplica_fondos_reserva   INTEGER NOT NULL DEFAULT 1,
    aplica_horas_extras     INTEGER NOT NULL DEFAULT 1,
    -- 1 = los valores se leyeron en el texto oficial; 0 = hay algo por confirmar (ver notas)
    verificado              INTEGER NOT NULL DEFAULT 0,
    notas                   TEXT NOT NULL DEFAULT ''
);

INSERT INTO regimenes (
    codigo, nombre, descripcion, base_legal, tipo, iess_personal, iess_patronal,
    recargo_suplementarias, recargo_extraordinarias, recargo_descanso, recargo_nocturno,
    tope_suplementarias_mes, tope_extraordinarias_mes, dias_vacaciones, fondos_reserva, meses_para_fondos,
    verificado, notas
) VALUES (
    'CODIGO_TRABAJO', 'Código del Trabajo',
    'Trabajadores del sector privado y obreros del sector público.',
    'Código del Trabajo arts. 49, 55, 69, 71, 111, 113 y 196; aportes: página del IESS.',
    'reglas', 0.0945, 0.1115,
    0.5, 1, 1, 0.25,
    48, NULL, 15, 0.0833, 12,
    1,
    'Valores leídos del texto del Código del Trabajo. El tope de 48 horas suplementarias al mes es una referencia: la ley limita 4 por día y 12 por semana (12 x 4 semanas).'
)
ON CONFLICT DO NOTHING;

INSERT INTO regimenes (
    codigo, nombre, descripcion, base_legal, tipo, iess_personal, iess_patronal,
    recargo_suplementarias, recargo_extraordinarias, recargo_descanso, recargo_nocturno,
    tope_suplementarias_mes, tope_extraordinarias_mes, dias_vacaciones, fondos_reserva, meses_para_fondos,
    verificado, notas
) VALUES (
    'LOSEP', 'LOSEP (servidores públicos)',
    'Servidores públicos de carrera y de libre nombramiento de las instituciones del Estado.',
    'Ley Orgánica de Servicio Público (LOSEP) arts. 29, 97, 98, 99 y 114.',
    'reglas', 0.1145, 0.0915,
    0.25, 0.6, 1, 0.25,
    60, 60, 30, 0.0833, 12,
    0,
    'Recargos, topes y vacaciones leídos en la LOSEP (versión de 2016). Por confirmar: el aporte IESS de 11.45% personal y 9.15% patronal viene de fuentes secundarias (Disposición Transitoria 16 de la Ley de Seguridad Social y Resolución CD 501), y el recargo nocturno de 25% no figura en el art. 114.'
)
ON CONFLICT DO NOTHING;

INSERT INTO regimenes (
    codigo, nombre, descripcion, base_legal, tipo, regimen_servidor, regimen_obrero, verificado, notas
) VALUES (
    'LOEP', 'LOEP (empresas públicas)',
    'Personal de las empresas públicas: servidores de carrera y obreros.',
    'Ley Orgánica de Empresas Públicas (LOEP) arts. 17, 18 y 19.',
    'mixto', 'LOSEP', 'CODIGO_TRABAJO', 1,
    'La LOEP no fija tasas propias. Los servidores públicos de carrera se rigen por la ley de administración pública (LOSEP) y los obreros por el Código del Trabajo. El Directorio de cada empresa fija vacaciones y remuneraciones con normas internas: ajusta los regímenes si la empresa tiene reglas distintas.'
)
ON CONFLICT DO NOTHING;

-- A cuál se rige cada empleado. Si el régimen es mixto (LOEP), la categoría decide las reglas.
ALTER TABLE empleados ADD COLUMN regimen TEXT NOT NULL DEFAULT 'CODIGO_TRABAJO';
ALTER TABLE empleados ADD COLUMN categoria_loep TEXT;   -- 'servidor' | 'obrero'

-- Foto del régimen con que se calculó cada rol, para que el historial no cambie si luego
-- se editan los regímenes. Los roles anteriores se calcularon con el Código del Trabajo.
ALTER TABLE roles_detalle ADD COLUMN regimen TEXT NOT NULL DEFAULT 'CODIGO_TRABAJO';
ALTER TABLE roles_detalle ADD COLUMN regimen_aplicado TEXT NOT NULL DEFAULT 'CODIGO_TRABAJO';
ALTER TABLE roles_detalle ADD COLUMN tasa_iess_personal DOUBLE PRECISION NOT NULL DEFAULT 0.0945;
ALTER TABLE roles_detalle ADD COLUMN tasa_iess_patronal DOUBLE PRECISION NOT NULL DEFAULT 0.1115;
