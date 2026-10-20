import { httpResource } from '@angular/common/http';
import { PercentPipe } from '@angular/common';
import { Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ParametrosLey, valorSeguro } from '../core/api';
import { DineroPipe } from '../core/dinero.pipe';
import type { ResultadoSimulacion } from '../core/modelos';

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
  protected readonly reglasPropias = computed(
    () => this.ley()?.regimenes.filter((r) => r.tipo === 'reglas') ?? [],
  );

  // --- Simulador: se calcula en el servidor, con el mismo motor del sistema ---
  protected readonly sueldo = signal('1200');
  protected readonly horas = signal('');
  /** Espera a que termine de escribir para no consultar en cada tecla. */
  private readonly consulta = signal({
    sueldo: 1200, horasSuplementarias: 0, regimen: 'CODIGO_TRABAJO', categoriaLoep: 'servidor',
    decimos: 'mensual',
  });
  protected readonly decimos = signal('mensual');
  protected readonly regimen = signal('CODIGO_TRABAJO');
  protected readonly categoria = signal('servidor');
  protected readonly esMixto = computed(
    () => this.ley()?.regimenes.find((r) => r.codigo === this.regimen())?.tipo === 'mixto',
  );

  protected readonly entradaValida = computed(() => this.consulta().sueldo > 0);

  protected readonly simulacion = httpResource<ResultadoSimulacion>(() => {
    const c = this.consulta();
    if (c.sueldo <= 0) return undefined;
    return {
      url: '/api/simulacion',
      method: 'POST',
      body: {
        sueldo: c.sueldo,
        horasSuplementarias: c.horasSuplementarias,
        regimen: c.regimen,
        categoriaLoep: c.regimen === 'LOEP' ? c.categoriaLoep : undefined,
        decimos: c.decimos,
      },
    };
  });

  protected readonly resultado = valorSeguro(this.simulacion);

  constructor() {
    effect((alLimpiar) => {
      const sueldo = Number(this.sueldo().replace(',', '.'));
      const horasSuplementarias = Number(this.horas().replace(',', '.')) || 0;
      const regimen = this.regimen();
      const categoriaLoep = this.categoria();
      const decimos = this.decimos();
      const temporizador = setTimeout(
        () =>
          this.consulta.set({
            sueldo: Number.isFinite(sueldo) ? sueldo : 0, horasSuplementarias, regimen, categoriaLoep, decimos,
          }),
        250,
      );
      alLimpiar(() => clearTimeout(temporizador));
    });
  }

  protected elegir(campo: 'regimen' | 'categoria' | 'decimos', evento: Event) {
    const senal = { regimen: this.regimen, categoria: this.categoria, decimos: this.decimos }[campo];
    senal.set((evento.target as HTMLSelectElement).value);
  }

  protected escribir(campo: 'sueldo' | 'horas', evento: Event) {
    (campo === 'sueldo' ? this.sueldo : this.horas).set((evento.target as HTMLInputElement).value);
  }

  protected readonly anio = new Date().getFullYear();
}
