import { httpResource } from '@angular/common/http';
import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { Api, valorSeguro } from '../../core/api';
import type { DatosPuesto } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe } from '../../core/dinero.pipe';
import type { Grado, Puesto } from '../../core/modelos';

/** Lo que se escribe en el formulario de un puesto. */
interface Borrador {
  id: number | null;
  nombre: string;
  superiorId: string;
  funcion: string;
  responsabilidad: string;
  sector: string;
  escalaId: string;
}

const VACIO: Borrador = { id: null, nombre: '', superiorId: '', funcion: '', responsabilidad: '', sector: '', escalaId: '' };

/** Un puesto con su profundidad en el orgánico (para saber qué cuelga de qué al editar). */
interface Linea {
  puesto: Puesto;
  nivel: number;
}

/** Un puesto con los puestos que dependen de él: un nodo del organigrama. */
interface Nodo {
  puesto: Puesto;
  hijos: Nodo[];
}

/**
 * Orgánico funcional: de quién depende cada puesto, qué función y responsabilidad tiene, en qué
 * sector económico está y qué nivel de la escala salarial le sirve de referencia.
 */
@Component({
  selector: 'app-organico',
  imports: [DineroPipe, NgTemplateOutlet],
  template: `
    <div class="encabezado">
      <h1>Orgánico funcional</h1>
    </div>

    <section class="hoja" aria-labelledby="titulo-organico">
      <div class="hoja-titulo">
        <h2 id="titulo-organico">Organigrama</h2>
        <p>
          Cada recuadro es un puesto, con el nombre de su responsable. Toca uno para ver su función,
          su responsabilidad, el sector económico y la referencia salarial, o para cambiar a su responsable.
          Los niveles de ejemplo salen de una tabla de clase y están <strong>por confirmar</strong>.
        </p>
      </div>
      <div class="hoja-cuerpo">
        <ng-template #nodoPlantilla let-nodo>
          <li>
            <button type="button" class="caja-puesto" [class.activa]="nodo.puesto.id === seleccionado()?.id"
                    [attr.aria-pressed]="nodo.puesto.id === seleccionado()?.id" (click)="seleccionar(nodo.puesto)">
              <span class="caja-nombre">{{ nodo.puesto.nombre }}</span>
              @if (nodo.puesto.responsable; as r) {
                <span class="caja-persona">{{ r.nombres }}</span>
              } @else {
                <span class="caja-persona caja-vacia">Sin responsable</span>
              }
              @if (nodo.puesto.referencia; as ref) {
                <span class="caja-nivel">{{ ref.denominacion }}</span>
              }
            </button>
            @if (nodo.hijos.length) {
              <ul>
                @for (hijo of nodo.hijos; track hijo.puesto.id) {
                  <ng-container [ngTemplateOutlet]="nodoPlantilla" [ngTemplateOutletContext]="{ $implicit: hijo }" />
                }
              </ul>
            }
          </li>
        </ng-template>

        @if (arbol().length) {
          <div class="arbol-contenedor">
            <ul class="arbol">
              @for (raiz of arbol(); track raiz.puesto.id) {
                <ng-container [ngTemplateOutlet]="nodoPlantilla" [ngTemplateOutletContext]="{ $implicit: raiz }" />
              }
            </ul>
          </div>
        } @else {
          <p class="tabla-vacia">
            @if (puestos.isLoading()) { Cargando el organigrama… }
            @else { Todavía no hay puestos. Agrega el primero con el formulario de abajo. }
          </p>
        }
      </div>
    </section>

    @if (seleccionado(); as p) {
      <section class="hoja detalle-puesto" aria-labelledby="titulo-detalle">
        <div class="hoja-titulo">
          <h2 id="titulo-detalle">{{ p.nombre }}</h2>
          <p class="apoyo pequeno">
            {{ p.empleados }} {{ p.empleados === 1 ? 'empleado ocupa' : 'empleados ocupan' }} este puesto
            @if (jefe(p); as j) { · depende de {{ j.nombre }} }
          </p>
        </div>
        <div class="hoja-cuerpo">
          <p class="responsable" [class.sin-responsable]="!p.responsable">
            <span class="etiqueta-responsable">Responsable</span>
            @if (p.responsable; as r) {
              <strong>{{ r.nombres }}</strong>
            } @else {
              Sin responsable asignado
            }
          </p>
          <dl class="ficha-puesto">
            <dt>Función</dt><dd>{{ p.funcion }}</dd>
            <dt>Responsabilidad</dt><dd>{{ p.responsabilidad }}</dd>
            <dt>Sector económico</dt><dd>{{ p.sector }}</dd>
            <dt>Referencia salarial</dt>
            <dd>
              @if (p.referencia; as r) {
                {{ r.denominacion }}: {{ r.esMinimo ? 'mínimo ' : '' }}{{ r.rmu | dinero }}
                @if (r.rmuMax) { <span class="apoyo pequeno">(según la rama, hasta {{ r.rmuMax | dinero }})</span> }
              } @else {
                Sin nivel: elige uno al editar el puesto.
              }
            </dd>
            <dt>Ocupantes</dt>
            <dd>
              @if (p.ocupantes.length) {
                {{ nombresDe(p) }}
              } @else {
                Nadie. Asigna el puesto al crear o editar un empleado.
              }
            </dd>
          </dl>
          @if (p.ocupantes.length) {
            <div class="asignar-responsable no-imprimir">
              <label [for]="'responsable-' + p.id">Cambiar responsable</label>
              <select class="entrada" [id]="'responsable-' + p.id"
                      (change)="asignarResponsable(p, $any($event.target).value)">
                <option value="" [selected]="!p.responsable">Sin responsable</option>
                @for (o of p.ocupantes; track o.id) {
                  <option [value]="o.id" [selected]="p.responsable?.id === o.id">{{ o.nombres }}</option>
                }
              </select>
            </div>
          }
          <div class="acciones-puesto">
            <button class="boton-texto" type="button" (click)="editar(p)">Editar puesto</button>
            <button class="boton-texto boton-peligro" type="button" (click)="eliminar(p)">Eliminar puesto</button>
          </div>
        </div>
      </section>
    }

    <section class="hoja" aria-labelledby="titulo-puesto">
      <div class="hoja-titulo">
        <h2 id="titulo-puesto">{{ borrador().id === null ? 'Agregar un puesto' : 'Editar «' + borrador().nombre + '»' }}</h2>
      </div>
      <div class="hoja-cuerpo">
        <form class="formulario" (submit)="$event.preventDefault(); guardar()">
          <div class="campo c3">
            <label for="puesto-nombre">Nombre del puesto</label>
            <input class="entrada" id="puesto-nombre" maxlength="100"
                   [value]="borrador().nombre" (input)="cambiar('nombre', $any($event.target).value)" />
          </div>
          <div class="campo c3">
            <label for="puesto-superior">Depende de</label>
            <select class="entrada" id="puesto-superior" (change)="cambiar('superiorId', $any($event.target).value)">
              <option value="" [selected]="borrador().superiorId === ''">Nadie: es la cabeza del orgánico</option>
              @for (p of posiblesSuperiores(); track p.id) {
                <option [value]="p.id" [selected]="borrador().superiorId === '' + p.id">{{ p.nombre }}</option>
              }
            </select>
          </div>
          <div class="campo">
            <label for="puesto-funcion">Función</label>
            <textarea class="entrada" id="puesto-funcion" rows="2" maxlength="400"
                      [value]="borrador().funcion" (input)="cambiar('funcion', $any($event.target).value)"></textarea>
          </div>
          <div class="campo">
            <label for="puesto-responsabilidad">Responsabilidad</label>
            <textarea class="entrada" id="puesto-responsabilidad" rows="2" maxlength="400"
                      [value]="borrador().responsabilidad"
                      (input)="cambiar('responsabilidad', $any($event.target).value)"></textarea>
          </div>
          <div class="campo c3">
            <label for="puesto-sector">Sector económico</label>
            <input class="entrada" id="puesto-sector" maxlength="120"
                   [value]="borrador().sector" (input)="cambiar('sector', $any($event.target).value)" />
            <span class="ayuda">La rama de la comisión sectorial en la que está la empresa.</span>
          </div>
          <div class="campo c3">
            <label for="puesto-escala">Referencia salarial</label>
            <select class="entrada" id="puesto-escala" (change)="cambiar('escalaId', $any($event.target).value)">
              <option value="" [selected]="borrador().escalaId === ''">Elige un nivel de la escala</option>
              @for (g of niveles(); track g.id) {
                <option [value]="g.id" [selected]="borrador().escalaId === '' + g.id">
                  {{ g.regimen }} · {{ g.denominacion }} ({{ g.esMinimo ? 'mínimo ' : '' }}{{ g.rmu | dinero }})
                </option>
              }
            </select>
          </div>
          <div class="acciones">
            <button class="boton" [disabled]="guardando()">
              {{ borrador().id === null ? 'Agregar puesto' : 'Guardar cambios' }}
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
export class Organico {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);

  protected readonly puestos = httpResource<Puesto[]>(() => '/api/puestos');
  private readonly todos = valorSeguro(this.puestos);
  private readonly escala = valorSeguro(httpResource<Grado[]>(() => '/api/escala'));

  /** Los niveles que un puesto puede tomar como referencia: todos los de la escala. */
  protected readonly niveles = computed(() => this.escala() ?? []);

  /** Puesto elegido en el organigrama; mientras no se elija ninguno, la cabeza del organigrama. */
  private readonly elegidoId = signal<number | null>(null);
  protected readonly seleccionado = computed(() => {
    const todos = this.todos() ?? [];
    return todos.find((p) => p.id === this.elegidoId()) ?? this.arbol()[0]?.puesto;
  });

  protected readonly borrador = signal<Borrador>(VACIO);
  protected readonly guardando = signal(false);

  /** El orgánico en orden de lectura: cada puesto seguido de sus subordinados. */
  protected readonly lineas = computed<Linea[]>(() => {
    const todos = this.todos() ?? [];
    const ids = new Set(todos.map((p) => p.id));
    const hijosDe = (id: number | null) => todos.filter((p) => p.superiorId === id);
    const resultado: Linea[] = [];
    const recorrer = (p: Puesto, nivel: number) => {
      resultado.push({ puesto: p, nivel });
      hijosDe(p.id).forEach((h) => recorrer(h, nivel + 1));
    };
    // Cabezas: sin superior, o con un superior que ya no existe.
    todos.filter((p) => p.superiorId === null || !ids.has(p.superiorId)).forEach((p) => recorrer(p, 0));
    return resultado;
  });

  /** El organigrama: las cabezas (sin superior, o con uno que ya no existe) con sus subordinados debajo. */
  protected readonly arbol = computed<Nodo[]>(() => {
    const todos = this.todos() ?? [];
    const ids = new Set(todos.map((p) => p.id));
    const nodo = (p: Puesto): Nodo => ({ puesto: p, hijos: todos.filter((h) => h.superiorId === p.id).map(nodo) });
    return todos.filter((p) => p.superiorId === null || !ids.has(p.superiorId)).map(nodo);
  });

  /** Al editar, un puesto no puede depender de sí mismo ni de sus subordinados. */
  protected readonly posiblesSuperiores = computed(() => {
    const id = this.borrador().id;
    if (id === null) return this.todos() ?? [];
    const debajo = new Set<number>([id]);
    for (const l of this.lineas()) {
      if (l.puesto.superiorId !== null && debajo.has(l.puesto.superiorId)) debajo.add(l.puesto.id);
    }
    return (this.todos() ?? []).filter((p) => !debajo.has(p.id));
  });

  protected seleccionar(p: Puesto) {
    this.elegidoId.set(p.id);
  }

  /** El puesto del que depende `p`, si tiene. */
  protected jefe(p: Puesto) {
    return (this.todos() ?? []).find((x) => x.id === p.superiorId);
  }

  protected nombresDe(p: Puesto) {
    return p.ocupantes.map((o) => o.nombres).join(', ');
  }

  protected vacio(): Borrador {
    return VACIO;
  }

  protected cambiar(campo: keyof Borrador, valor: string) {
    this.borrador.update((b) => ({ ...b, [campo]: valor }));
  }

  protected editar(p: Puesto) {
    this.borrador.set({
      id: p.id, nombre: p.nombre, superiorId: p.superiorId === null ? '' : String(p.superiorId),
      funcion: p.funcion, responsabilidad: p.responsabilidad, sector: p.sector,
      escalaId: p.escalaId === null ? '' : String(p.escalaId),
    });
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  /** Pone o quita al responsable del puesto y refresca el orgánico. */
  protected async asignarResponsable(p: Puesto, valor: string) {
    this.avisos.limpiar();
    try {
      const actualizado = await firstValueFrom(this.api.asignarResponsable(p.id, valor === '' ? null : Number(valor)));
      this.avisos.exito(
        actualizado.responsable
          ? `${actualizado.responsable.nombres} es el responsable de «${p.nombre}».`
          : `«${p.nombre}» quedó sin responsable.`,
      );
    } catch (error) {
      this.avisos.errorHttp(error);
    } finally {
      this.puestos.reload();
    }
  }

  protected async eliminar(p: Puesto) {
    if (!confirm(`¿Eliminar el puesto «${p.nombre}»? Los empleados que lo ocupan conservan su sueldo.`)) return;
    this.avisos.limpiar();
    try {
      await firstValueFrom(this.api.eliminarPuesto(p.id));
      this.avisos.exito(`Se eliminó el puesto «${p.nombre}».`);
      this.puestos.reload();
    } catch (error) {
      this.avisos.errorHttp(error);
    }
  }

  protected async guardar() {
    this.avisos.limpiar();
    const b = this.borrador();
    const datos: DatosPuesto = {
      nombre: b.nombre,
      superiorId: b.superiorId === '' ? null : Number(b.superiorId),
      funcion: b.funcion,
      responsabilidad: b.responsabilidad,
      sector: b.sector,
      escalaId: b.escalaId === '' ? null : Number(b.escalaId),
    };
    this.guardando.set(true);
    try {
      await firstValueFrom(b.id === null ? this.api.crearPuesto(datos) : this.api.editarPuesto(b.id, datos));
      this.avisos.exito(b.id === null ? 'Se agregó el puesto.' : 'Se guardaron los cambios del puesto.');
      this.borrador.set(VACIO);
      this.puestos.reload();
    } catch (error) {
      this.avisos.errorHttp(error);
      window.scrollTo({ top: 0 });
    } finally {
      this.guardando.set(false);
    }
  }
}
