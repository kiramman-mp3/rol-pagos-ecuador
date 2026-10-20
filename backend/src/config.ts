/** Datos de la empresa que aparecen en el rol y en la boleta (editar para el taller). */
export const EMPRESA = { nombre: "Empresa Demo S.A.", ruc: "1790000000001" };

export const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const CONTRATOS = ["Indefinido", "Plazo fijo", "Eventual", "Ocasional", "Obra o servicio"];

export interface EmpleadoDemo {
  cedula: string;
  nombres: string;
  cargo: string;
  sueldoBase: number;
  fechaIngreso: string;
  tipoContrato: string;
  regimen: string;
  categoriaLoep: string | null;
  /** régimen cuya escala salarial se aplica (en la LOEP lo decide la categoría) */
  escalaRegimen: string;
  /** grado de esa escala */
  escalaGrado: number;
}

/** Seis empleados que muestran los tres regímenes (Código del Trabajo, LOSEP y LOEP). */
export const EMPLEADOS_DEMO: readonly EmpleadoDemo[] = [
  { cedula: "1801234566", nombres: "María Fernanda Paredes", cargo: "Gerente General", sueldoBase: 4500, fechaIngreso: "2019-03-01", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 1 },
  { cedula: "1702345677", nombres: "Carlos Andrés Villacís", cargo: "Contador", sueldoBase: 1800, fechaIngreso: "2022-07-15", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 2 },
  { cedula: "0903456788", nombres: "Lucía Estefanía Mora", cargo: "Asistente Administrativa", sueldoBase: 675, fechaIngreso: "2024-02-01", tipoContrato: "Plazo fijo", regimen: "LOSEP", categoriaLoep: null, escalaRegimen: "LOSEP", escalaGrado: 5 },
  { cedula: "0104567896", nombres: "José Luis Camacho", cargo: "Vendedor", sueldoBase: 900, fechaIngreso: "2025-11-03", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 8 },
  { cedula: "1715678908", nombres: "Daniela Alejandra Ruiz", cargo: "Analista de Sistemas", sueldoBase: 2670, fechaIngreso: "2023-05-10", tipoContrato: "Indefinido", regimen: "LOEP", categoriaLoep: "servidor", escalaRegimen: "LOSEP", escalaGrado: 19 },
  { cedula: "0606789014", nombres: "Pedro Pablo Guamán", cargo: "Bodeguero", sueldoBase: 482, fechaIngreso: "2026-10-16", tipoContrato: "Eventual", regimen: "LOEP", categoriaLoep: "obrero", escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 11 },
];
