import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export type TipoAviso = 'success' | 'danger' | 'warning' | 'info';

export interface Aviso {
  id: number;
  tipo: TipoAviso;
  texto: string;
  /** Pantalla en la que nació; sirve para retirarlo dos navegaciones después. */
  generacion: number;
}

/**
 * Mensajes para la persona usuaria. Un aviso creado justo antes de navegar
 * (por ejemplo "Empleado guardado") sobrevive a esa navegación y se retira en la siguiente.
 */
@Injectable({ providedIn: 'root' })
export class Avisos {
  private readonly _lista = signal<Aviso[]>([]);
  readonly lista = this._lista.asReadonly();

  private generacion = 0;
  private siguienteId = 1;

  constructor() {
    inject(Router)
      .events.pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => {
        this.generacion++;
        this._lista.update((l) => l.filter((a) => a.generacion >= this.generacion - 1));
      });
  }

  exito(texto: string) {
    this.agregar('success', texto);
  }
  aviso(texto: string) {
    this.agregar('warning', texto);
  }
  error(texto: string) {
    this.agregar('danger', texto);
  }

  /** Muestra los mensajes que devuelve la API ({ errores: string[] }) o uno genérico. */
  errorHttp(error: unknown) {
    const errores = (error as HttpErrorResponse)?.error?.errores;
    if (Array.isArray(errores) && errores.length) {
      errores.forEach((e: string) => this.error(e));
    } else {
      this.error('No se pudo completar la acción. Revisa que el servidor esté encendido.');
    }
  }

  limpiar() {
    this._lista.set([]);
  }

  private agregar(tipo: TipoAviso, texto: string) {
    this._lista.update((l) => [...l, { id: this.siguienteId++, tipo, texto, generacion: this.generacion }]);
  }
}
