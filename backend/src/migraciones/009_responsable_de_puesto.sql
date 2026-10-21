-- Responsable de cada puesto del orgánico: el empleado que lo encabeza. Debe ocupar el puesto;
-- si se borra el empleado, el puesto queda sin responsable.
ALTER TABLE puestos ADD COLUMN responsable_id INTEGER REFERENCES empleados(id) ON DELETE SET NULL;
