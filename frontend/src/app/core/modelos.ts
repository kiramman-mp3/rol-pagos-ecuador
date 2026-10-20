/** Formas de los datos que entrega la API (ver backend/src/rutas). */

export interface Empleado {
  id: number;
  cedula: string;
  nombres: string;
  cargo: string;
  sueldoBase: number;
  fechaIngreso: string;
  tipoContrato: string;
  /** Código del régimen: CODIGO_TRABAJO, LOSEP o LOEP */
  regimen: string;
  /** Solo para LOEP: 'servidor' u 'obrero' */
  categoriaLoep: string | null;
  /** Grado de la escala salarial, si el sueldo sigue una escala */
  escalaId: number | null;
  /** null = lo que diga el régimen (por defecto, se paga cada mes en el rol) */
  pagoDecimoTercero: Modalidad | null;
  pagoDecimoCuarto: Modalidad | null;
  pagoFondosReserva: Modalidad | null;
  /** null = lo que diga el régimen */
  recibeHorasExtras: boolean | null;
  activo: boolean;
  /** Solo viene al crear o editar: avisos que no bloquean el guardado. */
  avisos?: string[];
}

export type DatosEmpleado = Omit<Empleado, 'id' | 'activo' | 'avisos'>;

/** Un grado de la escala salarial con su remuneración mensual unificada. */
export interface Grado {
  id: number;
  regimen: string;
  grado: number;
  denominacion: string;
  rmu: number;
  fuente: string;
}

export interface TramoIr {
  desde: number;
  hasta: number | null;
  cuota: number;
  porcentaje: number;
}

/** Cómo se recibe un beneficio: no, dentro del rol cada mes, o acumulado (provisión). */
export type Modalidad = 'no' | 'mensual' | 'acumulado';

/** Reglas de un régimen laboral. Los porcentajes son fracciones (0.0945 = 9.45%). */
export interface Regimen {
  codigo: string;
  nombre: string;
  descripcion: string;
  baseLegal: string;
  /** 'mixto' remite a otros regímenes según la categoría (la LOEP) */
  tipo: 'reglas' | 'mixto';
  regimenServidor: string | null;
  regimenObrero: string | null;
  iessPersonal: number | null;
  iessPatronal: number | null;
  recargoSuplementarias: number | null;
  recargoExtraordinarias: number | null;
  recargoDescanso: number | null;
  recargoNocturno: number | null;
  topeSuplementariasMes: number | null;
  topeExtraordinariasMes: number | null;
  diasVacaciones: number | null;
  fondosReserva: number | null;
  mesesParaFondos: number | null;
  aplicaDecimoTercero: boolean;
  aplicaDecimoCuarto: boolean;
  aplicaFondosReserva: boolean;
  aplicaHorasExtras: boolean;
  /** false = hay algo por confirmar (ver notas) */
  verificado: boolean;
  notas: string;
}

export interface Parametros {
  anio: number;
  sbu: number;
  iessPersonal: number;
  iessPatronal: number;
  fondosReserva: number;
  fraccionExentaIr: number;
  tablaIr: TramoIr[];
  empresa: { nombre: string; ruc: string };
  meses: string[];
  contratos: string[];
  regimenes: Regimen[];
  categoriasLoep: string[];
}

/** La simulación agrega el régimen con que se calculó. */
export interface ResultadoSimulacion extends ResultadoRol {
  regimenAplicado: string;
  tasaIessPersonal: number;
  tasaIessPatronal: number;
}

/** Cálculo de un rol; lo comparten la simulación y cada fila del detalle. */
export interface ResultadoRol {
  diasTrabajados: number;
  mesesServicio: number;
  valorHora: number;
  sueldo: number;
  horasSuplementarias: number;
  horasExtraordinarias: number;
  horasDescanso: number;
  horasNocturnas: number;
  valorHorasSuplementarias: number;
  valorHorasExtraordinarias: number;
  valorHorasDescanso: number;
  valorRecargoNocturno: number;
  comisiones: number;
  /** Base del IESS y del impuesto: sueldo, horas extras y comisiones */
  ingresosAportables: number;
  /** Décimos y fondos de reserva pagados dentro del rol */
  beneficiosMensuales: number;
  totalIngresos: number;
  aporteIess: number;
  baseIrAnual: number;
  irAnual: number;
  impuestoRenta: number;
  otrosDescuentos: number;
  totalDescuentos: number;
  netoPagar: number;
  decimoTercero: number;
  decimoTerceroModalidad: Modalidad;
  decimoCuarto: number;
  decimoCuartoModalidad: Modalidad;
  fondosReserva: number;
  fondosReservaModalidad: Modalidad;
  vacaciones: number;
  aportePatronal: number;
  totalProvisiones: number;
  costoEmpleador: number;
}

export interface RolDetalle extends ResultadoRol {
  id: number;
  empleadoId: number | null;
  cedula: string;
  nombres: string;
  cargo: string;
  sueldoBase: number;
  fechaIngreso: string;
  regimen: string;
  regimenAplicado: string;
  tasaIessPersonal: number;
  tasaIessPatronal: number;
}

export interface RolCabecera {
  id: number;
  anio: number;
  mes: number;
  generadoEn: string;
  numEmpleados: number;
  totalIngresos: number;
  totalDescuentos: number;
  totalNeto: number;
  totalProvisiones: number;
  totalCosto: number;
}

export interface RolCompleto extends RolCabecera {
  detalle: RolDetalle[];
}

export interface Novedades {
  horasSuplementarias: number;
  horasExtraordinarias: number;
  horasDescanso: number;
  horasNocturnas: number;
  comisiones: number;
  otrosDescuentos: number;
}

export interface EmpleadoDelPeriodo {
  id: number;
  nombres: string;
  cargo: string;
  sueldoBase: number;
  regimen: string;
  regimenAplicado: string;
  /** false = sus horas suplementarias, extraordinarias y de descanso no se pagan */
  recibeHorasExtras: boolean;
  novedades: Novedades;
}

export interface Periodo {
  anio: number;
  mes: number;
  existe: boolean;
  empleados: EmpleadoDelPeriodo[];
}

export interface EntradaSimulacion {
  sueldo: number;
  regimen?: string;
  categoriaLoep?: string;
  /** Modalidad de los décimos y fondos de reserva; sin ella, la del régimen */
  decimos?: Modalidad;
  horasSuplementarias?: number;
  horasExtraordinarias?: number;
  comisiones?: number;
}
