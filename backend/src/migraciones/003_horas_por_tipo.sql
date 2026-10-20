-- Las horas extras pasan a tener tipo propio, porque el recargo depende del régimen:
--   suplementarias  Código del Trabajo +50%, LOSEP +25%
--   extraordinarias Código del Trabajo +100%, LOSEP +60%   (de 24h00 a 06h00 en días hábiles)
--   de descanso     +100% en ambos                          (sábados, domingos y feriados)
--   nocturnas       +25%                                    (solo el recargo)
-- Lo que antes se llamaba "horas al 50%" y "horas al 100%" conserva su significado
-- en el Código del Trabajo: suplementarias y de descanso.
ALTER TABLE novedades RENAME COLUMN horas_50 TO horas_suplementarias;
ALTER TABLE novedades RENAME COLUMN horas_100 TO horas_descanso;
ALTER TABLE novedades ADD COLUMN horas_extraordinarias REAL NOT NULL DEFAULT 0;

ALTER TABLE roles_detalle RENAME COLUMN horas_50 TO horas_suplementarias;
ALTER TABLE roles_detalle RENAME COLUMN horas_100 TO horas_descanso;
ALTER TABLE roles_detalle RENAME COLUMN valor_horas_50 TO valor_horas_suplementarias;
ALTER TABLE roles_detalle RENAME COLUMN valor_horas_100 TO valor_horas_descanso;
ALTER TABLE roles_detalle ADD COLUMN horas_extraordinarias REAL NOT NULL DEFAULT 0;
ALTER TABLE roles_detalle ADD COLUMN valor_horas_extraordinarias REAL NOT NULL DEFAULT 0;
