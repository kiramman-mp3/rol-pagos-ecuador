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
  /** puesto del orgánico funcional, si el régimen tiene puestos */
  puesto: string | null;
  /** true si es quien encabeza ese puesto en el orgánico */
  responsable?: boolean;
}

/**
 * Doce empleados con la estructura del orgánico funcional (gerente -> administrador -> supervisor,
 * operaciones y auxiliar de guardalmacén), más dos de la LOSEP y la LOEP que muestran los otros regímenes.
 * Cada uno cobra al menos el mínimo del nivel de su puesto.
 */
export const EMPLEADOS_DEMO: readonly EmpleadoDemo[] = [
  { cedula: "1712345675", nombres: "Johan Gabriel Rodríguez", cargo: "Gerente / Propietario", sueldoBase: 2800, fechaIngreso: "2019-03-01", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 1, puesto: "Gerente / Propietario", responsable: true },
  { cedula: "1703456788", nombres: "José Gabriel Manzano", cargo: "Administrador / Contador", sueldoBase: 1500, fechaIngreso: "2021-06-01", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 2, puesto: "Administrador / Contador", responsable: true },
  { cedula: "0903456788", nombres: "Lucía Estefanía Mora", cargo: "Asistente Administrativa", sueldoBase: 675, fechaIngreso: "2024-02-01", tipoContrato: "Plazo fijo", regimen: "LOSEP", categoriaLoep: null, escalaRegimen: "LOSEP", escalaGrado: 5, puesto: null },
  { cedula: "1710456797", nombres: "David Barragán", cargo: "Supervisor de instalaciones", sueldoBase: 850, fechaIngreso: "2022-09-12", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 4, puesto: "Supervisor de instalaciones", responsable: true },
  { cedula: "1715678908", nombres: "Daniela Alejandra Ruiz", cargo: "Analista de Sistemas", sueldoBase: 2670, fechaIngreso: "2023-05-10", tipoContrato: "Indefinido", regimen: "LOEP", categoriaLoep: "servidor", escalaRegimen: "LOSEP", escalaGrado: 19, puesto: null },
  { cedula: "0606789014", nombres: "Pedro Pablo Guamán", cargo: "Auxiliar de guardalmacén", sueldoBase: 482, fechaIngreso: "2026-10-16", tipoContrato: "Eventual", regimen: "LOEP", categoriaLoep: "obrero", escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 11, puesto: "Auxiliar de guardalmacén" },
  { cedula: "1714567805", nombres: "Maybeline Navarro", cargo: "Operaciones de instalaciones", sueldoBase: 600, fechaIngreso: "2023-04-03", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 6, puesto: "Operaciones de instalaciones", responsable: true },
  { cedula: "1705678918", nombres: "Andrea Paola Villavicencio", cargo: "Supervisor de instalaciones", sueldoBase: 720, fechaIngreso: "2024-01-15", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 4, puesto: "Supervisor de instalaciones" },
  { cedula: "1706789029", nombres: "Santiago Andrés Cevallos", cargo: "Operaciones de instalaciones", sueldoBase: 640, fechaIngreso: "2024-08-01", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 6, puesto: "Operaciones de instalaciones" },
  { cedula: "1707890131", nombres: "Karen Michelle Salazar", cargo: "Operaciones de instalaciones", sueldoBase: 620, fechaIngreso: "2025-02-10", tipoContrato: "Plazo fijo", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 6, puesto: "Operaciones de instalaciones" },
  { cedula: "1718901240", nombres: "Luis Fernando Tipán", cargo: "Auxiliar de guardalmacén", sueldoBase: 500, fechaIngreso: "2025-07-01", tipoContrato: "Indefinido", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 11, puesto: "Auxiliar de guardalmacén", responsable: true },
  { cedula: "1709012353", nombres: "Mayra Alejandra Chicaiza", cargo: "Auxiliar de guardalmacén", sueldoBase: 482, fechaIngreso: "2026-03-02", tipoContrato: "Plazo fijo", regimen: "CODIGO_TRABAJO", categoriaLoep: null, escalaRegimen: "CODIGO_TRABAJO", escalaGrado: 11, puesto: "Auxiliar de guardalmacén" },
];
