import { HttpClient, HttpResourceRef, httpResource } from '@angular/common/http';
import { Injectable, computed, inject } from '@angular/core';

import type {
  DatosEmpleado,
  Empleado,
  EntradaSimulacion,
  Parametros,
  ResultadoRol,
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

  simular(entrada: EntradaSimulacion) {
    return this.http.post<ResultadoRol>('/api/simulacion', entrada);
  }
}

/** Reglas de ley 2026 y datos de la empresa, cargados una sola vez. */
@Injectable({ providedIn: 'root' })
export class ParametrosLey {
  readonly recurso = httpResource<Parametros>(() => '/api/parametros');
  readonly valor = valorSeguro(this.recurso);
}
