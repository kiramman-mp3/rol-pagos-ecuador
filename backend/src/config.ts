/** Datos de la empresa que aparecen en el rol y en la boleta (editar para el taller). */
export const EMPRESA = { nombre: "Empresa Demo S.A.", ruc: "1790000000001" };

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const CONTRATOS = ["Indefinido", "Plazo fijo", "Eventual", "Ocasional", "Obra o servicio"];

export const EMPLEADOS_DEMO = [
  ["1801234566", "María Fernanda Paredes", "Gerente General", 4500, "2019-03-01", "Indefinido"],
  ["1702345677", "Carlos Andrés Villacís", "Contador", 1800, "2022-07-15", "Indefinido"],
  ["0903456788", "Lucía Estefanía Mora", "Asistente Administrativa", 650, "2024-02-01", "Plazo fijo"],
  ["0104567896", "José Luis Camacho", "Vendedor", 900, "2025-11-03", "Indefinido"],
  ["1715678908", "Daniela Alejandra Ruiz", "Analista de Sistemas", 2600, "2023-05-10", "Indefinido"],
  ["0606789014", "Pedro Pablo Guamán", "Bodeguero", 482, "2026-10-16", "Eventual"],
] as const;
