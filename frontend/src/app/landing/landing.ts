import { httpResource } from '@angular/common/http';
import { PercentPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ParametrosLey, valorSeguro } from '../core/api';
import { DineroPipe } from '../core/dinero.pipe';
import type { ResultadoRol } from '../core/modelos';

/** Página de inicio pública: explica el sistema y lleva a /sistema. */
@Component({
  selector: 'app-landing',
  imports: [RouterLink, DineroPipe, PercentPipe],
  templateUrl: './landing.html',
  styleUrl: './landing.css',
})
export class Landing {
  protected readonly parametros = inject(ParametrosLey);
  protected readonly ley = this.parametros.valor;

  // --- Simulador: se calcula en el servidor, con el mismo motor del sistema ---
  protected readonly sueldo = signal('1200');
  protected readonly horas = signal('');
  /** Espera a que termine de escribir para no consultar en cada tecla. */
  private readonly consulta = signal({ sueldo: 1200, horasSuplementarias: 0 });

  protected readonly entradaValida = computed(() => this.consulta().sueldo > 0);

  protected readonly simulacion = httpResource<ResultadoRol>(() => {
    const c = this.consulta();
    if (c.sueldo <= 0) return undefined;
    return { url: '/api/simulacion', method: 'POST', body: { sueldo: c.sueldo, horasSuplementarias: c.horasSuplementarias } };
  });

  protected readonly resultado = valorSeguro(this.simulacion);

  constructor() {
    effect((alLimpiar) => {
      const sueldo = Number(this.sueldo().replace(',', '.'));
      const horasSuplementarias = Number(this.horas().replace(',', '.')) || 0;
      const temporizador = setTimeout(
        () => this.consulta.set({ sueldo: Number.isFinite(sueldo) ? sueldo : 0, horasSuplementarias }),
        250,
      );
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  protected escribir(campo: 'sueldo' | 'horas', evento: Event) {
    (campo === 'sueldo' ? this.sueldo : this.horas).set((evento.target as HTMLInputElement).value);
  }

  protected readonly anio = new Date().getFullYear();
}
