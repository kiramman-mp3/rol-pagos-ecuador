import { Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { Avisos } from '../core/avisos';
import { ParametrosLey } from '../core/api';

/** Barra superior, navegación y avisos de todas las pantallas del sistema. */
@Component({
  selector: 'app-shell',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="barra">
      <div class="barra-interior">
        <a class="marca" routerLink="/" title="Volver a la página de inicio">
          Rol de pagos<small>Ecuador 2026</small>
        </a>
        <nav class="navegacion" aria-label="Principal">
          <a routerLink="/sistema/empleados" routerLinkActive ariaCurrentWhenActive="page">Empleados</a>
          <a routerLink="/sistema/roles" routerLinkActive ariaCurrentWhenActive="page">Roles de pago</a>
        </nav>
        <span class="empresa">{{ parametros()?.empresa?.nombre }}</span>
      </div>
    </header>

    <main class="pagina">
      @for (aviso of avisos.lista(); track aviso.id) {
        <div class="aviso aviso-{{ aviso.tipo }} no-imprimir" role="status">{{ aviso.texto }}</div>
      }
      <router-outlet />
    </main>
  `,
})
export class Shell {
  protected readonly avisos = inject(Avisos);
  protected readonly parametros = inject(ParametrosLey).valor;
}
