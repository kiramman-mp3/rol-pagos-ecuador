-- Opciones por empleado. Cada una puede quedar vacía (NULL) y entonces vale lo que diga
-- el régimen: si el régimen concede el beneficio, se paga cada mes en el rol.
--   pago_*: 'no' | 'mensual' | 'acumulado'
--   recibe_horas_extras: 0 | 1 (por ejemplo, el nivel jerárquico superior de la LOSEP no las cobra)
ALTER TABLE empleados ADD COLUMN pago_decimo_tercero TEXT;
ALTER TABLE empleados ADD COLUMN pago_decimo_cuarto TEXT;
ALTER TABLE empleados ADD COLUMN pago_fondos_reserva TEXT;
ALTER TABLE empleados ADD COLUMN recibe_horas_extras INTEGER;

-- Cada rol guarda cómo se pagó cada beneficio y cuánto fue aportable.
-- Los roles anteriores provisionaban todo, así que quedan como 'acumulado'.
ALTER TABLE roles_detalle ADD COLUMN ingresos_aportables REAL NOT NULL DEFAULT 0;
ALTER TABLE roles_detalle ADD COLUMN beneficios_mensuales REAL NOT NULL DEFAULT 0;
ALTER TABLE roles_detalle ADD COLUMN decimo_tercero_modalidad TEXT NOT NULL DEFAULT 'acumulado';
ALTER TABLE roles_detalle ADD COLUMN decimo_cuarto_modalidad TEXT NOT NULL DEFAULT 'acumulado';
ALTER TABLE roles_detalle ADD COLUMN fondos_reserva_modalidad TEXT NOT NULL DEFAULT 'acumulado';
UPDATE roles_detalle SET ingresos_aportables = total_ingresos;
