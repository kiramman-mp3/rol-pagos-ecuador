import { httpResource } from '@angular/common/http';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ParametrosLey, valorSeguro } from '../../core/api';
import { DineroPipe } from '../../core/dinero.pipe';
import type { RolCabecera } from '../../core/modelos';

@Component({
  selector: 'app-lista-roles',
  imports: [RouterLink, DineroPipe],
  styles: `
    .selector-anio { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; }
    .cambio-anio { display: inline-flex; align-items: center; gap: .4rem; font: 800 1.3rem var(--display); }
    .cambio-anio .boton-texto { font-size: 1.5rem; line-height: 1; padding: .2rem .7rem; }
    .meses { list-style: none; margin: 0; padding: 1rem 1.4rem 1.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(10.5rem, 1fr)); gap: .8rem; }
    .mes {
      display: flex; flex-direction: column; align-items: flex-start; gap: .3rem; height: 100%;
      padding: .95rem 1rem; border-radius: 18px; text-decoration: none; color: var(--tinta);
      background: var(--hoja); border: 1.5px solid var(--linea);
      transition: transform .12s ease, box-shadow .12s ease, border-color .12s ease;
    }
    .mes:hover { transform: translateY(-3px); border-color: var(--marca); box-shadow: var(--sombra); color: var(--tinta); }
    .mes-nombre { font: 800 1.15rem var(--display); }
    .mes-cifra { font-weight: 700; font-size: .95rem; color: var(--tinta-suave); }
    .mes-generado { background: var(--neto-fondo); border-color: #b5e8cf; }
    .mes-generado .mes-cifra { color: var(--neto); font-size: 1.05rem; }
    .mes-toca { background: var(--sol-fondo); border-color: var(--sol); box-shadow: 0 0 0 3px var(--sol); }
    .mes-toca .mes-cifra { color: var(--tinta); }
    .mes-falta { border-style: dashed; }
    .mes-actual { box-shadow: 0 0 0 3px var(--sol); }
    .mes-futuro { background: transparent; border-style: dashed; }
    .mes-futuro .mes-nombre { color: var(--tinta-suave); }
    .insignia { margin-top: auto; }
  `,
  template: `
    <div class="encabezado">
      <div>
        <h1>Roles de pago</h1>
        <p class="apoyo">Un rol por mes. Si recalculas uno que ya existe, se reemplaza.</p>
      </div>
    </div>

    <section class="hoja" aria-labelledby="titulo-generar">
      <div class="hoja-titulo selector-anio">
        <div>
          <h2 id="titulo-generar">¿Qué mes vas a pagar?</h2>
          <p>Toca un mes para anotar sus novedades y generar el rol, o para abrir el que ya existe.</p>
        </div>
        <div class="cambio-anio" role="group" aria-label="Año">
          <button class="boton-texto" type="button" (click)="cambiarAnio(-1)" [attr.aria-label]="'Ir a ' + (anio() - 1)">‹</button>
          <strong>{{ anio() }}</strong>
          <button class="boton-texto" type="button" (click)="cambiarAnio(1)" [attr.aria-label]="'Ir a ' + (anio() + 1)">›</button>
        </div>
      </div>
      <ol class="meses">
        @for (m of meses(); track m.numero) {
          <li>
            <a class="mes mes-{{ m.estado }}" [class.mes-actual]="m.actual" [routerLink]="m.enlace" [attr.aria-current]="m.actual ? 'date' : null">
              <span class="mes-nombre">{{ m.nombre }}</span>
              @switch (m.estado) {
                @case ('generado') {
                  <span class="mes-cifra">{{ m.rol!.totalNeto | dinero }}</span>
                  <span class="insignia insignia-neto">Generado</span>
                }
                @case ('toca') {
                  <span class="mes-cifra">Toca este mes</span>
                  <span class="insignia insignia-sol">Anotar novedades</span>
                }
                @case ('falta') {
                  <span class="mes-cifra">Sin rol</span>
                  <span class="insignia insignia-suave">Generar</span>
                }
                @default {
                  <span class="mes-cifra">Por venir</span>
                  <span class="insignia insignia-suave">Preparar</span>
                }
              }
            </a>
          </li>
        }
      </ol>
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
              <th class="num t-neto"><span class="th-largo">Neto a pagar</span><span class="th-corto" aria-hidden="true">Neto</span></th>
              <th class="num"><span class="th-largo">Costo empleador</span><span class="th-corto" aria-hidden="true">Costo</span></th>
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
  protected readonly parametros = inject(ParametrosLey).valor;
  protected readonly roles = httpResource<RolCabecera[]>(() => '/api/roles');
  private readonly cargados = valorSeguro(this.roles);
  protected readonly historial = computed(() => this.cargados() ?? []);

  private readonly hoy = new Date();
  protected readonly anio = signal(this.hoy.getFullYear());

  /** Los 12 meses del año elegido, cada uno con su estado y a dónde lleva. */
  protected readonly meses = computed(() => {
    const anio = this.anio();
    const actual = this.hoy.getFullYear() * 12 + this.hoy.getMonth();
    return (this.parametros()?.meses ?? []).map((nombre, i) => {
      const numero = i + 1;
      const rol = this.historial().find((r) => r.anio === anio && r.mes === numero);
      const posicion = anio * 12 + i;
      const estado = rol ? 'generado' : posicion === actual ? 'toca' : posicion < actual ? 'falta' : 'futuro';
      const enlace = rol ? ['/sistema/roles', String(rol.id)] : ['/sistema/roles/novedades', String(anio), String(numero)];
      return { numero, nombre, rol, estado, enlace, actual: posicion === actual };
    });
  });

  protected nombreMes(mes: number): string {
    return this.parametros()?.meses[mes - 1] ?? '';
  }

  protected cambiarAnio(paso: number) {
    this.anio.update((a) => a + paso);
  }
}
