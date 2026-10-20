import { Component, signal } from '@angular/core';

import { EscalaSalarial } from './escala';
import { ParametrosAnuales } from './anuales';
import { RegimenesLaborales } from './regimenes';

type Pestana = 'anual' | 'regimenes' | 'escala';

const PESTANAS: { id: Pestana; etiqueta: string }[] = [
  { id: 'anual', etiqueta: 'Año: SBU e impuesto a la renta' },
  { id: 'regimenes', etiqueta: 'Regímenes laborales' },
  { id: 'escala', etiqueta: 'Escala salarial' },
];

/** Las reglas de ley que usa el rol, editables sin tocar el código. */
@Component({
  selector: 'app-parametros',
  imports: [ParametrosAnuales, RegimenesLaborales, EscalaSalarial],
  template: `
    <div class="encabezado">
      <div>
        <h1>Parámetros</h1>
        <p class="apoyo">
          Las reglas de ley con que se calcula el rol. Cámbialas aquí cuando cambie la normativa: los roles ya
          generados conservan los valores con que se calcularon.
        </p>
      </div>
    </div>

    <div class="pestanas" role="tablist" aria-label="Tipos de parámetros">
      @for (p of pestanas; track p.id) {
        <button type="button" role="tab" class="pestana" [id]="'pestana-' + p.id"
                [attr.aria-selected]="actual() === p.id" [attr.aria-controls]="'panel-' + p.id"
                [class.activa]="actual() === p.id" (click)="actual.set(p.id)">
          {{ p.etiqueta }}
        </button>
      }
    </div>

    <div role="tabpanel" [id]="'panel-' + actual()" [attr.aria-labelledby]="'pestana-' + actual()">
      @switch (actual()) {
        @case ('anual') { <app-parametros-anuales /> }
        @case ('regimenes') { <app-regimenes-laborales /> }
        @case ('escala') { <app-escala-salarial /> }
      }
    </div>
  `,
})
export class PaginaParametros {
  protected readonly pestanas = PESTANAS;
  protected readonly actual = signal<Pestana>('anual');
}
