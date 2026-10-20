import { httpResource } from '@angular/common/http';
import { Component, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import { Avisos } from '../../core/avisos';
import type { Parametros, TramoIr } from '../../core/modelos';

/** Un tramo de la tabla del IR tal como se escribe en pantalla (el porcentaje va en %). */
interface FilaTramo {
  hasta: string;
  cuota: string;
  porcentaje: string;
}

/** SBU y tabla del impuesto a la renta de cada año. */
@Component({
  selector: 'app-parametros-anuales',
  template: `
    <section class="hoja" aria-labelledby="titulo-anual">
      <div class="hoja-titulo">
        <h2 id="titulo-anual">Valores del año</h2>
        <p>El sueldo básico unificado y la tabla del impuesto a la renta cambian cada año por resolución.</p>
      </div>
      <div class="hoja-cuerpo">
        @if (datos(); as p) {
          @if (!p.exacto && !esNuevo()) {
            <div class="aviso aviso-warning" role="status">
              No hay valores de {{ p.anioSolicitado }}; se muestran los de {{ p.anio }}.
            </div>
          }

          <div class="fila-form" style="margin-bottom: 1.25rem">
            <div class="campo">
              <label for="anio-elegido">Año</label>
              <select class="entrada" id="anio-elegido" (change)="elegirAnio($any($event.target).value)">
                @for (a of p.anios; track a) {
                  <option [value]="a" [selected]="a === anioEdicion()">{{ a }}</option>
                }
                @if (esNuevo()) {
                  <option [value]="anioEdicion()" selected>{{ anioEdicion() }} (nuevo)</option>
                }
              </select>
            </div>
            <div class="campo" style="min-width: 7rem">
              <label for="anio-nuevo">Agregar un año</label>
              <input class="entrada num" id="anio-nuevo" type="number" min="2000" max="2100"
                     placeholder="2027" [value]="nuevoAnio()" (input)="nuevoAnio.set($any($event.target).value)" />
            </div>
            <button class="boton boton-claro" type="button" (click)="agregarAnio()">
              Crear copiando el año {{ p.anio }}
            </button>
          </div>

          <form class="formulario" (submit)="$event.preventDefault(); guardar()">
            <div class="campo c2">
              <label for="sbu">Sueldo básico unificado (USD)</label>
              <input class="entrada num" id="sbu" type="number" step="0.01" min="0.01"
                     [value]="sbu()" (input)="sbu.set($any($event.target).value)" />
            </div>
            <div class="campo c4">
              <label for="fuente">Fuente</label>
              <input class="entrada" id="fuente" maxlength="300"
                     [value]="fuente()" (input)="fuente.set($any($event.target).value)" />
              <span class="ayuda">Resolución o acuerdo de donde salen los valores.</span>
            </div>

            <div class="campo" style="grid-column: 1 / -1">
              <h3>Tabla del impuesto a la renta (anual, personas naturales)</h3>
              <div class="deslizable">
                <table class="tabla">
                  <caption class="solo-lectura">Tramos del impuesto a la renta de {{ anioEdicion() }}</caption>
                  <thead>
                    <tr>
                      <th class="num">Desde (USD)</th>
                      <th class="num">Hasta (USD)</th>
                      <th class="num"><span class="th-largo">Impuesto de la fracción básica (USD)</span><span class="th-corto" aria-hidden="true">Imp. fracción</span></th>
                      <th class="num"><span class="th-largo">Sobre el excedente (%)</span><span class="th-corto" aria-hidden="true">Excedente %</span></th>
                      <th><span class="solo-lectura">Quitar</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (t of tramos(); track $index; let i = $index; let ultimo = $last) {
                      <tr>
                        <td class="num">{{ desde(i) }}</td>
                        <td class="num">
                          @if (ultimo) {
                            <span class="apoyo">En adelante</span>
                          } @else {
                            <input class="entrada entrada-compacta num" type="number" step="0.01" min="0"
                                   [attr.aria-label]="'Hasta del tramo ' + (i + 1)"
                                   [value]="t.hasta" (input)="cambiar(i, 'hasta', $any($event.target).value)" />
                          }
                        </td>
                        <td class="num">
                          <input class="entrada entrada-compacta num" type="number" step="0.01" min="0"
                                 [attr.aria-label]="'Cuota del tramo ' + (i + 1)"
                                 [value]="t.cuota" (input)="cambiar(i, 'cuota', $any($event.target).value)" />
                        </td>
                        <td class="num">
                          <input class="entrada entrada-compacta num" type="number" step="0.01" min="0" max="100"
                                 [attr.aria-label]="'Porcentaje del tramo ' + (i + 1)"
                                 [value]="t.porcentaje" (input)="cambiar(i, 'porcentaje', $any($event.target).value)" />
                        </td>
                        <td class="num">
                          @if (tramos().length > 1) {
                            <button class="boton-texto boton-peligro" type="button" (click)="quitarTramo(i)">Quitar</button>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
              <div>
                <button class="boton-texto" type="button" (click)="agregarTramo()">Agregar un tramo</button>
              </div>
            </div>

            <div class="acciones">
              <button class="boton" [disabled]="guardando()">Guardar los valores de {{ anioEdicion() }}</button>
            </div>
          </form>
        } @else if (recurso.error()) {
          <p class="apoyo">No se pudieron cargar los parámetros. Revisa que el servidor esté encendido.</p>
        } @else {
          <p class="apoyo">Cargando…</p>
        }
      </div>
    </section>
  `,
})
export class ParametrosAnuales {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  private readonly general = inject(ParametrosLey);

  /** Año pedido al servidor; null = el vigente. */
  private readonly pedido = signal<number | null>(null);
  protected readonly recurso = httpResource<Parametros>(() =>
    this.pedido() === null ? '/api/parametros' : `/api/parametros?anio=${this.pedido()}`,
  );
  protected readonly datos = valorSeguro(this.recurso);

  protected readonly anioEdicion = signal(0);
  protected readonly esNuevo = signal(false);
  protected readonly nuevoAnio = signal('');
  protected readonly sbu = signal('');
  protected readonly fuente = signal('');
  protected readonly tramos = signal<FilaTramo[]>([]);
  protected readonly guardando = signal(false);

  constructor() {
    // Al llegar los valores de un año, se cargan en el formulario.
    effect(() => {
      const p = this.datos();
      if (!p || this.esNuevo()) return;
      this.anioEdicion.set(p.anio);
      this.sbu.set(String(p.sbu));
      this.fuente.set(p.fuente);
      this.tramos.set(p.tablaIr.map(aFila));
    });
  }

  protected desde(indice: number): string {
    return indice === 0 ? '0' : this.tramos()[indice - 1].hasta || '…';
  }

  protected cambiar(indice: number, campo: keyof FilaTramo, valor: string) {
    this.tramos.update((t) => t.map((f, i) => (i === indice ? { ...f, [campo]: valor } : f)));
  }

  protected agregarTramo() {
    // El tramo nuevo entra antes del último, que siempre queda abierto.
    this.tramos.update((t) => [...t.slice(0, -1), { hasta: '', cuota: '0', porcentaje: '0' }, t[t.length - 1]]);
  }

  protected quitarTramo(indice: number) {
    this.tramos.update((t) => t.filter((_, i) => i !== indice));
  }

  protected elegirAnio(valor: string) {
    this.esNuevo.set(false);
    this.pedido.set(Number(valor));
  }

  /** Un año nuevo parte de los valores que se están viendo. */
  protected agregarAnio() {
    const anio = Number(this.nuevoAnio());
    if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
      this.avisos.error('Escribe un año entre 2000 y 2100.');
      return;
    }
    if (this.datos()?.anios.includes(anio)) {
      this.avisos.error(`El año ${anio} ya existe: elígelo en la lista.`);
      return;
    }
    this.avisos.limpiar();
    this.esNuevo.set(true);
    this.anioEdicion.set(anio);
    this.nuevoAnio.set('');
  }

  protected async guardar() {
    this.avisos.limpiar();
    const filas = this.tramos();
    const tablaIr: TramoIr[] = filas.map((f, i) => ({
      desde: i === 0 ? 0 : Number(filas[i - 1].hasta),
      hasta: i === filas.length - 1 ? null : Number(f.hasta),
      cuota: Number(f.cuota),
      porcentaje: Number((Number(f.porcentaje) / 100).toFixed(6)),
    }));
    this.guardando.set(true);
    try {
      const anio = this.anioEdicion();
      await firstValueFrom(
        this.api.guardarParametros(anio, { sbu: Number(this.sbu()), tablaIr, fuente: this.fuente() }),
      );
      this.avisos.exito(`Se guardaron los valores de ${anio}.`);
      this.esNuevo.set(false);
      this.pedido.set(anio);
      this.recurso.reload();
      this.general.recurso.reload();
    } catch (error) {
      this.avisos.errorHttp(error);
      window.scrollTo({ top: 0 });
    } finally {
      this.guardando.set(false);
    }
  }
}

function aFila(t: TramoIr): FilaTramo {
  return {
    hasta: t.hasta === null ? '' : String(t.hasta),
    cuota: String(t.cuota),
    porcentaje: String(Number((t.porcentaje * 100).toFixed(4))),
  };
}
