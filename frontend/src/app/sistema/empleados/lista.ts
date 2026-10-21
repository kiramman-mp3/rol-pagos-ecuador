import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe } from '../../core/dinero.pipe';
import type { Empleado } from '../../core/modelos';

@Component({
  selector: 'app-lista-empleados',
  imports: [RouterLink, DineroPipe],
  styles: `
    .persona > span:last-child { min-width: 9.5rem; }
    @media (max-width: 720px) { .ocultar-movil { display: none; } }
    .herramientas { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .buscador { flex: 1 1 18rem; max-width: 26rem; border-radius: 999px; padding-inline: 1.1rem; }
    .filtros { display: flex; gap: .4rem; flex-wrap: wrap; }
    .chip {
      font: 700 .875rem var(--cuerpo); color: var(--tinta-suave); background: var(--hoja); cursor: pointer;
      border: 1.5px solid var(--linea); border-radius: 999px; padding: .45rem .9rem;
    }
    .chip:hover { border-color: var(--marca); color: var(--tinta); }
    .chip.activo { background: var(--tinta); border-color: var(--tinta); color: #fff; }
    .chip-cuenta { margin-left: .3rem; opacity: .75; }
    .confirmar { display: inline-flex; align-items: center; justify-content: flex-end; gap: .25rem; flex-wrap: wrap; white-space: normal; font-size: .85rem; font-weight: 600; color: var(--descuentos); max-width: 20rem; text-align: right; }
  `,
  template: `
    <div class="encabezado">
      <div>
        <h1>Empleados</h1>
        <p class="apoyo">Solo los empleados activos entran al rol de cada mes.</p>
      </div>
      <div class="acciones">
        @if (!lista().length && !empleados.isLoading()) {
          <button class="boton boton-claro" type="button" (click)="cargarDemo()">
            Cargar datos de ejemplo
          </button>
        }
        <a class="boton" routerLink="/sistema/empleados/nuevo">Agregar empleado</a>
      </div>
    </div>

    @if (lista().length) {
      <div class="herramientas no-imprimir">
        <label class="solo-lectura" for="buscar">Buscar empleado</label>
        <input class="entrada buscador" id="buscar" type="search" placeholder="Buscar por nombre, cédula o cargo"
               [value]="busqueda()" (input)="busqueda.set($any($event.target).value)" />
        <div class="filtros" role="group" aria-label="Filtrar por estado">
          @for (f of filtros(); track f.valor) {
            <button type="button" class="chip" [class.activo]="filtro() === f.valor"
                    [attr.aria-pressed]="filtro() === f.valor" (click)="filtro.set(f.valor)">
              {{ f.nombre }} <span class="chip-cuenta">{{ f.cuenta }}</span>
            </button>
          }
        </div>
      </div>
    }

    <div class="hoja">
      <div class="deslizable">
        <table class="tabla">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Cargo</th>
              <th>Régimen</th>
              <th class="ocultar-movil">Contrato</th>
              <th class="num ocultar-movil">Ingreso</th>
              <th class="num"><span class="th-largo">Sueldo base</span><span class="th-corto" aria-hidden="true">Sueldo</span></th>
              <th>Estado</th>
              <th><span class="solo-lectura">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            @for (e of visibles(); track e.id) {
              <tr [class.fila-inactiva]="!e.activo">
                <td>
                  <div class="persona">
                    <span class="avatar avatar-{{ claseRegimen(e.regimen) }}" aria-hidden="true">{{ iniciales(e.nombres) }}</span>
                    <span>{{ e.nombres }}<span class="secundario">{{ e.cedula }}</span></span>
                  </div>
                </td>
                <td>{{ e.cargo }}</td>
                <td>
                  {{ nombreRegimen(e.regimen) }}
                  @if (e.categoriaLoep) { <span class="secundario">{{ e.categoriaLoep === 'obrero' ? 'Obrero' : 'Servidor' }}</span> }
                </td>
                <td class="ocultar-movil">{{ e.tipoContrato }}</td>
                <td class="num ocultar-movil">{{ fecha(e.fechaIngreso) }}</td>
                <td class="num">{{ e.sueldoBase | dinero }}</td>
                <td>
                  <span class="estado" [class.estado-activo]="e.activo" [class.estado-inactivo]="!e.activo">
                    {{ e.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="num">
                  @if (porEliminar() === e.id) {
                    <span class="confirmar" role="alert">
                      ¿Eliminar a {{ e.nombres }}? Sus roles ya generados se conservan.
                      <button class="boton-texto boton-peligro" type="button" (click)="eliminar(e)">Sí, eliminar</button>
                      <button class="boton-texto" type="button" (click)="porEliminar.set(null)">No</button>
                    </span>
                  } @else {
                    <a class="boton-texto" [routerLink]="['/sistema/empleados', e.id, 'editar']">Editar</a>
                    <button class="boton-texto" type="button" (click)="cambiarEstado(e)">
                      {{ e.activo ? 'Desactivar' : 'Activar' }}
                    </button>
                    <button class="boton-texto boton-peligro" type="button" (click)="porEliminar.set(e.id)">Eliminar</button>
                  }
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="tabla-vacia">
                  @if (empleados.isLoading()) {
                    Cargando empleados…
                  } @else if (empleados.error()) {
                    No se pudo cargar la lista. Revisa que el servidor esté encendido y
                    <button class="boton-texto" type="button" (click)="empleados.reload()">vuelve a intentar</button>.
                  } @else if (lista().length) {
                    Nadie coincide con esa búsqueda.
                    <button class="boton-texto" type="button" (click)="limpiarFiltros()">Ver a todos</button>
                  } @else {
                    Todavía no hay empleados. Agrega el primero o carga los datos de ejemplo para probar el rol.
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class ListaEmpleados {
  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  private readonly parametros = inject(ParametrosLey).valor;
  protected readonly empleados = httpResource<Empleado[]>(() => '/api/empleados');
  private readonly cargados = valorSeguro(this.empleados);
  protected readonly lista = computed(() => this.cargados() ?? []);

  protected readonly busqueda = signal('');
  protected readonly filtro = signal<'todos' | 'activos' | 'inactivos'>('todos');
  protected readonly porEliminar = signal<number | null>(null);

  protected readonly filtros = computed(() => {
    const todos = this.lista();
    const activos = todos.filter((e) => e.activo).length;
    return [
      { valor: 'todos' as const, nombre: 'Todos', cuenta: todos.length },
      { valor: 'activos' as const, nombre: 'Activos', cuenta: activos },
      { valor: 'inactivos' as const, nombre: 'Inactivos', cuenta: todos.length - activos },
    ];
  });

  protected readonly visibles = computed(() => {
    const texto = this.busqueda().trim().toLowerCase();
    const filtro = this.filtro();
    return this.lista().filter(
      (e) =>
        (filtro === 'todos' || (filtro === 'activos') === e.activo) &&
        (!texto || `${e.nombres} ${e.cedula} ${e.cargo}`.toLowerCase().includes(texto)),
    );
  });

  protected iniciales(nombres: string): string {
    return nombres.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
  }

  /** El color de las iniciales sale del régimen laboral. */
  protected claseRegimen(codigo: string): string {
    return codigo === 'LOSEP' ? 'losep' : codigo === 'LOEP' ? 'loep' : 'codigo';
  }

  /** 2024-01-01 -> 1 ene 2024 */
  protected fecha(iso: string): string {
    const f = new Date(`${iso}T12:00:00`);
    return Number.isNaN(f.getTime())
      ? iso
      : f.toLocaleDateString('es-EC', { day: 'numeric', month: 'short', year: 'numeric' }).replace(/\./g, '');
  }

  protected limpiarFiltros() {
    this.busqueda.set('');
    this.filtro.set('todos');
  }

  protected nombreRegimen(codigo: string): string {
    return this.parametros()?.regimenes.find((r) => r.codigo === codigo)?.nombre ?? codigo;
  }

  protected async cargarDemo() {
    await this.ejecutar(async () => {
      await firstValueFrom(this.api.cargarDemo());
      this.avisos.exito('Se cargaron los empleados de ejemplo.');
    });
  }

  protected async cambiarEstado(e: Empleado) {
    await this.ejecutar(() => firstValueFrom(this.api.cambiarEstado(e.id)));
  }

  protected async eliminar(e: Empleado) {
    this.porEliminar.set(null);
    await this.ejecutar(async () => {
      await firstValueFrom(this.api.eliminarEmpleado(e.id));
      this.avisos.exito('Empleado eliminado. Los roles ya generados se conservan.');
    });
  }

  private async ejecutar(accion: () => Promise<unknown>) {
    this.avisos.limpiar();
    try {
      await accion();
      this.empleados.reload();
    } catch (error) {
      this.avisos.errorHttp(error);
    }
  }
}
