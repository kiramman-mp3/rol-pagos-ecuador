import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import type { DatosGrado } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe } from '../../core/dinero.pipe';
import type { Grado } from '../../core/modelos';

/** Lo que se escribe en el formulario de un grado. */
interface Borrador {
  id: number | null;
  grado: string;
  denominacion: string;
  rmu: string;
  rmuMax: string;
  esMinimo: boolean;
  fuente: string;
}

const VACIO: Borrador = { id: null, grado: '', denominacion: '', rmu: '', rmuMax: '', esMinimo: false, fuente: '' };

/** Grados con su remuneración mensual unificada, por régimen. */
@Component({
  selector: 'app-escala-salarial',
  imports: [DineroPipe],
  template: `
    <section class="hoja" aria-labelledby="titulo-escala">
      <div class="hoja-titulo">
        <h2 id="titulo-escala">Escala salarial</h2>
        <p>
          Al crear un empleado se elige un grado de esta tabla y el sueldo sale de él. En la LOSEP el sueldo es la
          remuneración del grado; en los niveles de «mínimo» (Código del Trabajo) puede ser mayor, nunca menor.
          Las escalas de ejemplo son de fuentes secundarias o de clase: están <strong>por confirmar</strong> con el
          Ministerio del Trabajo.
        </p>
      </div>

      <div class="hoja-cuerpo">
        <div class="fila-form" style="margin-bottom: 1rem">
          <div class="campo">
            <label for="escala-regimen">Régimen</label>
            <select class="entrada" id="escala-regimen" (change)="regimen.set($any($event.target).value)">
              @for (r of regimenes(); track r.codigo) {
                <option [value]="r.codigo" [selected]="r.codigo === regimen()">{{ r.nombre }}</option>
              }
            </select>
          </div>
        </div>

        <div class="deslizable">
          <table class="tabla">
            <thead>
              <tr>
                <th class="num">Grado</th>
                <th>Puesto</th>
                <th class="num"><span class="th-largo">Remuneración mensual</span><span class="th-corto" aria-hidden="true">Remuneración</span></th>
                <th>Fuente</th>
                <th><span class="solo-lectura">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              @for (g of grados(); track g.id) {
                <tr>
                  <td class="num">{{ g.grado }}</td>
                  <td>{{ g.denominacion }}</td>
                  <td class="num">
                    {{ g.esMinimo ? 'desde ' : '' }}{{ g.rmu | dinero }}
                    @if (g.rmuMax) { <span class="apoyo pequeno"> hasta {{ g.rmuMax | dinero }}</span> }
                  </td>
                  <td class="apoyo pequeno">{{ g.fuente }}</td>
                  <td class="num">
                    <button class="boton-texto" type="button" (click)="editar(g)">Editar</button>
                    <button class="boton-texto boton-peligro" type="button" (click)="eliminar(g)">Eliminar</button>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5" class="tabla-vacia">
                    @if (escala.isLoading()) { Cargando la escala… }
                    @else { Este régimen no tiene escala. Agrega el primer grado con el formulario de abajo. }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <section class="hoja" aria-labelledby="titulo-grado">
      <div class="hoja-titulo">
        <h2 id="titulo-grado">{{ borrador().id === null ? 'Agregar un grado' : 'Editar el grado ' + borrador().grado }}</h2>
      </div>
      <div class="hoja-cuerpo">
        <form class="formulario" (submit)="$event.preventDefault(); guardar()">
          <div class="campo c2">
            <label for="grado-numero">Grado</label>
            <input class="entrada num" id="grado-numero" type="number" min="1" max="99" step="1"
                   [value]="borrador().grado" (input)="cambiar('grado', $any($event.target).value)" />
          </div>
          <div class="campo c4">
            <label for="grado-puesto">Puesto</label>
            <input class="entrada" id="grado-puesto" maxlength="120"
                   [value]="borrador().denominacion" (input)="cambiar('denominacion', $any($event.target).value)" />
          </div>
          <div class="campo c3">
            <label for="grado-rmu">Remuneración mensual unificada (USD)</label>
            <input class="entrada num" id="grado-rmu" type="number" min="0.01" step="0.01"
                   [value]="borrador().rmu" (input)="cambiar('rmu', $any($event.target).value)" />
          </div>
          <div class="campo c3">
            <label for="grado-rmu-max">Tope del rango (opcional)</label>
            <input class="entrada num" id="grado-rmu-max" type="number" min="0.01" step="0.01"
                   [value]="borrador().rmuMax" (input)="cambiar('rmuMax', $any($event.target).value)" />
          </div>
          <div class="campo c3">
            <label for="grado-minimo">¿La remuneración es un mínimo?</label>
            <select class="entrada" id="grado-minimo" (change)="cambiarMinimo($any($event.target).value)">
              <option value="no" [selected]="!borrador().esMinimo">No: el sueldo es exactamente la remuneración</option>
              <option value="si" [selected]="borrador().esMinimo">Sí: el sueldo puede ser mayor, no menor</option>
            </select>
          </div>
          <div class="campo c3">
            <label for="grado-fuente">Fuente</label>
            <input class="entrada" id="grado-fuente" maxlength="200"
                   [value]="borrador().fuente" (input)="cambiar('fuente', $any($event.target).value)" />
          </div>
          <div class="acciones">
            <button class="boton" [disabled]="guardando()">
              {{ borrador().id === null ? 'Agregar grado' : 'Guardar cambios' }}
            </button>
            @if (borrador().id !== null) {
              <button class="boton boton-claro" type="button" (click)="borrador.set(vacio())">Cancelar</button>
            }
          </div>
        </form>
      </div>
    </section>
  `,
})
export class EscalaSalarial {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  private readonly general = inject(ParametrosLey);

  protected readonly escala = httpResource<Grado[]>(() => '/api/escala');
  private readonly todos = valorSeguro(this.escala);

  /** Solo los regímenes con reglas propias tienen escala (la LOEP usa las de los otros). */
  protected readonly regimenes = computed(
    () => this.general.valor()?.regimenes.filter((r) => r.tipo === 'reglas') ?? [],
  );
  protected readonly regimen = signal('LOSEP');
  protected readonly grados = computed(() => (this.todos() ?? []).filter((g) => g.regimen === this.regimen()));

  protected readonly borrador = signal<Borrador>(VACIO);
  protected readonly guardando = signal(false);

  protected vacio(): Borrador {
    return VACIO;
  }

  protected cambiar(campo: keyof Borrador, valor: string) {
    this.borrador.update((b) => ({ ...b, [campo]: valor }));
  }

  protected cambiarMinimo(valor: string) {
    this.borrador.update((b) => ({ ...b, esMinimo: valor === 'si' }));
  }

  protected editar(g: Grado) {
    this.borrador.set({
      id: g.id, grado: String(g.grado), denominacion: g.denominacion, rmu: String(g.rmu),
      rmuMax: g.rmuMax === null ? '' : String(g.rmuMax), esMinimo: g.esMinimo, fuente: g.fuente,
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  protected async eliminar(g: Grado) {
    if (!confirm(`¿Eliminar el grado ${g.grado}? Los empleados que lo usan conservan su sueldo.`)) return;
    this.avisos.limpiar();
    try {
      await firstValueFrom(this.api.eliminarGrado(g.id));
      this.avisos.exito(`Se eliminó el grado ${g.grado}.`);
      this.escala.reload();
    } catch (error) {
      this.avisos.errorHttp(error);
    }
  }

  protected async guardar() {
    this.avisos.limpiar();
    const b = this.borrador();
    const datos: DatosGrado = {
      regimen: this.regimen(),
      grado: Number(b.grado),
      denominacion: b.denominacion,
      rmu: Number(b.rmu),
      rmuMax: b.rmuMax === '' ? null : Number(b.rmuMax),
      esMinimo: b.esMinimo,
      fuente: b.fuente,
    };
    this.guardando.set(true);
    try {
      await firstValueFrom(b.id === null ? this.api.crearGrado(datos) : this.api.editarGrado(b.id, datos));
      this.avisos.exito(b.id === null ? 'Se agregó el grado.' : 'Se guardaron los cambios del grado.');
      this.borrador.set(VACIO);
      this.escala.reload();
    } catch (error) {
      this.avisos.errorHttp(error);
      window.scrollTo({ top: 0 });
    } finally {
      this.guardando.set(false);
    }
  }
}
