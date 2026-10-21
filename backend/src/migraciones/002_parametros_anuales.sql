-- Valores que cambian cada año por resolución: SBU y tabla del impuesto a la renta.
-- Antes eran constantes en el código; ahora se editan sin tocar nada más.
CREATE TABLE IF NOT EXISTS parametros_anuales (
    anio     INTEGER PRIMARY KEY,
    sbu      DOUBLE PRECISION NOT NULL CHECK (sbu > 0),
    -- Tramos del SRI como JSON: [{ "desde", "hasta" (null en el último), "cuota", "porcentaje" }]
    tabla_ir TEXT NOT NULL,
    fuente   TEXT NOT NULL DEFAULT ''
);

INSERT INTO parametros_anuales (anio, sbu, tabla_ir, fuente) VALUES (
    2026,
    482,
    '[{"desde":0,"hasta":12208,"cuota":0,"porcentaje":0},
      {"desde":12208,"hasta":15549,"cuota":0,"porcentaje":0.05},
      {"desde":15549,"hasta":20188,"cuota":167,"porcentaje":0.1},
      {"desde":20188,"hasta":26700,"cuota":631,"porcentaje":0.12},
      {"desde":26700,"hasta":35136,"cuota":1412,"porcentaje":0.15},
      {"desde":35136,"hasta":46575,"cuota":2678,"porcentaje":0.2},
      {"desde":46575,"hasta":62005,"cuota":4965,"porcentaje":0.25},
      {"desde":62005,"hasta":82679,"cuota":8823,"porcentaje":0.3},
      {"desde":82679,"hasta":109956,"cuota":15025,"porcentaje":0.35},
      {"desde":109956,"hasta":null,"cuota":24572,"porcentaje":0.37}]',
    'SBU: Acuerdo MDT-2025-195. IR: Resolución NAC-DGERCGC25-00000043 del SRI.'
)
ON CONFLICT DO NOTHING;
