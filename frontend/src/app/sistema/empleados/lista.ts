import { httpResource } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, valorSeguro } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe } from '../../core/dinero.pipe';
import type { Empleado } from '../../core/modelos';

@Component({
  selector: 'app-lista-empleados',
  imports: [RouterLink, DineroPipe],
  template: `
    <div class="encabezado">
      <div>
        <h1>Empleados</h1>
        <p class="apoyo">Solo los empleados activos entran al rol de cada mes.</p>
      </div>
      <div class="acciones">
        @if (lista()?.length === 0) {
          <button class="boton boton-claro" type="button" (click)="cargarDemo()">
            Cargar datos de ejemplo
          </button>
        }
        <a class="boton" routerLink="/sistema/empleados/nuevo">Agregar empleado</a>
      </div>
    </div>

    <div class="hoja">
      <div class="deslizable">
        <table class="tabla">
          <thead>
            <tr>
              <th>Empleado</th>
              <th>Cargo</th>
              <th>Contrato</th>
              <th>Ingreso</th>
              <th class="num">Sueldo base</th>
              <th>Estado</th>
              <th><span class="solo-lectura">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            @for (e of lista(); track e.id) {
              <tr [class.fila-inactiva]="!e.activo">
                <td>{{ e.nombres }}<span class="secundario">{{ e.cedula }}</span></td>
                <td>{{ e.cargo }}</td>
                <td>{{ e.tipoContrato }}</td>
                <td>{{ e.fechaIngreso }}</td>
                <td class="num">{{ e.sueldoBase | dinero }}</td>
                <td>
                  <span class="estado" [class.estado-activo]="e.activo" [class.estado-inactivo]="!e.activo">
                    {{ e.activo ? 'Activo' : 'Inactivo' }}
                  </span>
                </td>
                <td class="num">
                  <a class="boton-texto" [routerLink]="['/sistema/empleados', e.id, 'editar']">Editar</a>
                  <button class="boton-texto" type="button" (click)="cambiarEstado(e)">
                    {{ e.activo ? 'Desactivar' : 'Activar' }}
                  </button>
                  <button class="boton-texto boton-peligro" type="button" (click)="eliminar(e)">Eliminar</button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="tabla-vacia">
                  @if (empleados.isLoading()) {
                    Cargando empleados…
                  } @else if (empleados.error()) {
                    No se pudo cargar la lista. Revisa que el servidor esté encendido y
                    <button class="boton-texto" type="button" (click)="empleados.reload()">vuelve a intentar</button>.
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
  protected readonly empleados = httpResource<Empleado[]>(() => '/api/empleados');
  protected readonly lista = valorSeguro(this.empleados);

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
    if (!confirm(`¿Eliminar a ${e.nombres}? Sus roles ya generados se conservan.`)) return;
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
