import { httpResource } from '@angular/common/http';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe } from '../../core/dinero.pipe';
import type { DatosEmpleado, Empleado } from '../../core/modelos';

/** Alta y edición: la ruta /empleados/:id/editar entrega `id`; /empleados/nuevo no. */
@Component({
  selector: 'app-formulario-empleado',
  imports: [ReactiveFormsModule, RouterLink, DineroPipe],
  template: `
    <div class="encabezado">
      <h1>{{ id() ? 'Editar empleado' : 'Nuevo empleado' }}</h1>
    </div>

    <div class="hoja" style="max-width: 760px">
      <div class="hoja-cuerpo">
        <form class="formulario" [formGroup]="form" (ngSubmit)="guardar()">
          <div class="campo c2">
            <label for="cedula">Cédula</label>
            <input class="entrada" id="cedula" formControlName="cedula" maxlength="10"
                   inputmode="numeric" autocomplete="off" />
          </div>
          <div class="campo c4">
            <label for="nombres">Nombres completos</label>
            <input class="entrada" id="nombres" formControlName="nombres" />
          </div>
          <div class="campo c3">
            <label for="cargo">Cargo</label>
            <input class="entrada" id="cargo" formControlName="cargo" />
          </div>
          <div class="campo c3">
            <label for="tipoContrato">Tipo de contrato</label>
            <select class="entrada" id="tipoContrato" formControlName="tipoContrato">
              @for (c of parametros()?.contratos; track c) {
                <option [value]="c">{{ c }}</option>
              }
            </select>
          </div>
          <div class="campo c3">
            <label for="sueldoBase">Sueldo base (USD)</label>
            <input class="entrada num" id="sueldoBase" type="number" step="0.01" min="0.01"
                   formControlName="sueldoBase" />
            @if (parametros(); as p) {
              <span class="ayuda">El sueldo básico unificado de {{ p.anio }} es {{ p.sbu | dinero }}.</span>
            }
          </div>
          <div class="campo c3">
            <label for="fechaIngreso">Fecha de ingreso</label>
            <input class="entrada" id="fechaIngreso" type="date" formControlName="fechaIngreso" />
            <span class="ayuda">Si ingresa a mitad de mes, el primer rol paga solo los días trabajados.</span>
          </div>
          <div class="acciones">
            <button class="boton" [disabled]="guardando()">Guardar empleado</button>
            <a class="boton boton-claro" routerLink="/sistema/empleados">Cancelar</a>
          </div>
        </form>
      </div>
    </div>
  `,
})
export class FormularioEmpleado {
  readonly id = input<string>();

  private readonly api = inject(Api);
  private readonly avisos = inject(Avisos);
  private readonly router = inject(Router);
  protected readonly parametros = inject(ParametrosLey).valor;
  protected readonly guardando = signal(false);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    cedula: ['', Validators.required],
    nombres: ['', Validators.required],
    cargo: ['', Validators.required],
    tipoContrato: ['Indefinido', Validators.required],
    sueldoBase: [null as number | null, [Validators.required, Validators.min(0.01)]],
    fechaIngreso: ['', Validators.required],
  });

  private readonly actual = valorSeguro(
    httpResource<Empleado>(() => (this.id() ? `/api/empleados/${this.id()}` : undefined)),
  );

  constructor() {
    // Al llegar el empleado a editar, se llenan los campos.
    effect(() => {
      const e = this.actual();
      if (e) this.form.patchValue(e);
    });
  }

  protected async guardar() {
    this.avisos.limpiar();
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.avisos.error('Completa todos los campos antes de guardar.');
      return;
    }
    const datos = this.form.getRawValue() as DatosEmpleado;
    this.guardando.set(true);
    try {
      const id = this.id();
      const guardado = await firstValueFrom(
        id ? this.api.editarEmpleado(Number(id), datos) : this.api.crearEmpleado(datos),
      );
      guardado.avisos?.forEach((a) => this.avisos.aviso(a));
      this.avisos.exito('Empleado guardado.');
      await this.router.navigateByUrl('/sistema/empleados');
    } catch (error) {
      this.avisos.errorHttp(error);
      window.scrollTo({ top: 0 });
    } finally {
      this.guardando.set(false);
    }
  }
}
