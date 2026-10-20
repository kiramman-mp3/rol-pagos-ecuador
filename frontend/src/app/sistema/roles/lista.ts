import { httpResource } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';

import { ParametrosLey, valorSeguro } from '../../core/api';
import { DineroPipe } from '../../core/dinero.pipe';
import type { RolCabecera } from '../../core/modelos';

@Component({
  selector: 'app-lista-roles',
  imports: [RouterLink, DineroPipe],
  template: `
    <div class="encabezado">
      <div>
        <h1>Roles de pago</h1>
        <p class="apoyo">Un rol por mes. Si generas uno que ya existe, se reemplaza.</p>
      </div>
    </div>

    <section class="hoja" aria-labelledby="titulo-generar">
      <div class="hoja-titulo"><h2 id="titulo-generar">¿Qué mes vas a pagar?</h2></div>
      <div class="hoja-cuerpo">
        <form class="fila-form" (submit)="$event.preventDefault(); continuar()">
          <div class="campo">
            <label for="mes">Mes</label>
            <select class="entrada" id="mes" (change)="mes.set(+$any($event.target).value)">
              @for (nombre of parametros()?.meses; track $index) {
                <option [value]="$index + 1" [selected]="$index + 1 === mes()">{{ nombre }}</option>
              }
            </select>
          </div>
          <div class="campo" style="min-width: 6.5rem">
            <label for="anio">Año</label>
            <input class="entrada num" id="anio" type="number" min="2020" max="2100"
                   [value]="anio()" (input)="anio.set(+$any($event.target).value)" />
          </div>
          <button class="boton">Registrar novedades</button>
        </form>
      </div>
    </section>

    <section class="hoja" aria-labelledby="titulo-historial">
      <div class="hoja-titulo"><h2 id="titulo-historial">Roles generados</h2></div>
      <div class="deslizable">
        <table class="tabla">
          <thead>
            <tr>
              <th>Período</th>
              <th class="num">Empleados</th>
              <th class="num t-ingresos">Ingresos</th>
              <th class="num t-descuentos">Descuentos</th>
              <th class="num t-neto">Neto a pagar</th>
              <th class="num">Costo empleador</th>
              <th><span class="solo-lectura">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            @for (r of historial(); track r.id) {
              <tr>
                <td>
                  <a [routerLink]="['/sistema/roles', r.id]"><strong>{{ nombreMes(r.mes) }} {{ r.anio }}</strong></a>
                </td>
                <td class="num">{{ r.numEmpleados }}</td>
                <td class="num">{{ r.totalIngresos | dinero }}</td>
                <td class="num">{{ r.totalDescuentos | dinero }}</td>
                <td class="num c-neto">{{ r.totalNeto | dinero }}</td>
                <td class="num">{{ r.totalCosto | dinero }}</td>
                <td class="num">
                  <a class="boton-texto" [routerLink]="['/sistema/roles', r.id]">Abrir</a>
                  <a class="boton-texto" [href]="'/api/roles/' + r.id + '/csv'" download>Descargar CSV</a>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="7" class="tabla-vacia">
                  @if (roles.isLoading()) {
                    Cargando roles…
                  } @else if (roles.error()) {
                    No se pudo cargar el historial. Revisa que el servidor esté encendido.
                  } @else {
                    Aún no hay roles. Elige un mes arriba y registra las novedades para generar el primero.
                  }
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `,
})
export class ListaRoles {
  private readonly router = inject(Router);
  protected readonly parametros = inject(ParametrosLey).valor;
  protected readonly roles = httpResource<RolCabecera[]>(() => '/api/roles');
  protected readonly historial = valorSeguro(this.roles);

  protected readonly mes = signal(new Date().getMonth() + 1);
  protected readonly anio = signal(new Date().getFullYear());

  protected nombreMes(mes: number): string {
    return this.parametros()?.meses[mes - 1] ?? '';
  }

  protected continuar() {
    this.router.navigate(['/sistema/roles/novedades', this.anio(), this.mes()]);
  }
}
