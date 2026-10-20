import { HttpClient, HttpResourceRef, httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';

import type {
  DatosEmpleado,
  Empleado,
  EntradaSimulacion,
  Grado,
  Parametros,
  Puesto,
  Regimen,
  ResultadoSimulacion,
  TramoIr,
} from './modelos';

/** Lo que se digita en la grilla: texto de los campos, vacío = 0. */
export interface NovedadEnviada {
  empleadoId: number;
  horasSuplementarias: string;
  horasExtraordinarias: string;
  horasDescanso: string;
  horasNocturnas: string;
  comisiones: string;
  otrosDescuentos: string;
}

/** Lo que se envía al crear o editar un grado de la escala salarial. */
export type DatosGrado = Omit<Grado, 'id'>;

/** Lo que se envía al crear o editar un puesto del orgánico. */
export type DatosPuesto = Pick<Puesto, 'nombre' | 'superiorId' | 'funcion' | 'responsabilidad' | 'sector' | 'escalaId'>;

/**
 * Valor de un recurso HTTP, o undefined mientras carga o si falló.
 * Leer `recurso.value()` directamente lanza una excepción cuando el recurso está en error.
 */
export function valorSeguro<T>(recurso: HttpResourceRef<T | undefined>) {
  return computed(() => (recurso.hasValue() ? recurso.value() : undefined));
}

/**
 * Escrituras contra la API. Las lecturas de pantalla usan `httpResource` en cada
 * componente, que ya trae estados de carga y error como señales.
 */
@Injectable({ providedIn: 'root' })
export class Api {
  private readonly http = inject(HttpClient);

  crearEmpleado(datos: DatosEmpleado) {
    return this.http.post<Empleado>('/api/empleados', datos);
  }
  editarEmpleado(id: number, datos: DatosEmpleado) {
    return this.http.put<Empleado>(`/api/empleados/${id}`, datos);
  }
  cambiarEstado(id: number) {
    return this.http.patch<Empleado>(`/api/empleados/${id}/estado`, {});
  }
  eliminarEmpleado(id: number) {
    return this.http.delete<void>(`/api/empleados/${id}`);
  }
  cargarDemo() {
    return this.http.post<{ agregados: number }>('/api/empleados/demo', {});
  }

  generarRol(anio: number, mes: number, novedades: NovedadEnviada[]) {
    return this.http.post<{ id: number; empleados: number; avisos: string[] }>('/api/roles/generar', {
      anio,
      mes,
      novedades,
    });
  }
  eliminarRol(id: number) {
    return this.http.delete<void>(`/api/roles/${id}`);
  }

  guardarParametros(anio: number, datos: { sbu: number; tablaIr: TramoIr[]; fuente: string }) {
    return this.http.put<unknown>(`/api/parametros/${anio}`, datos);
  }
  guardarRegimen(codigo: string, datos: Record<string, unknown>) {
    return this.http.put<Regimen>(`/api/regimenes/${codigo}`, datos);
  }
  crearGrado(datos: DatosGrado) {
    return this.http.post<Grado>('/api/escala', datos);
  }
  editarGrado(id: number, datos: DatosGrado) {
    return this.http.put<Grado>(`/api/escala/${id}`, datos);
  }
  eliminarGrado(id: number) {
    return this.http.delete<void>(`/api/escala/${id}`);
  }

  crearPuesto(datos: DatosPuesto) {
    return this.http.post<Puesto>('/api/puestos', datos);
  }
  editarPuesto(id: number, datos: DatosPuesto) {
    return this.http.put<Puesto>(`/api/puestos/${id}`, datos);
  }
  asignarResponsable(id: number, empleadoId: number | null) {
    return this.http.patch<Puesto>(`/api/puestos/${id}/responsable`, { empleadoId });
  }
  eliminarPuesto(id: number) {
    return this.http.delete<void>(`/api/puestos/${id}`);
  }

  simular(entrada: EntradaSimulacion) {
    return this.http.post<ResultadoSimulacion>('/api/simulacion', entrada);
  }
}

/** Reglas de ley 2026 y datos de la empresa, cargados una sola vez. */
@Injectable({ providedIn: 'root' })
export class ParametrosLey {
  readonly recurso = httpResource<Parametros>(() => '/api/parametros');
  readonly valor = valorSeguro(this.recurso);
}
