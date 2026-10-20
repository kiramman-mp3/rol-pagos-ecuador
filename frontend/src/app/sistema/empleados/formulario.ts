import { httpResource } from '@angular/common/http';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { Api, ParametrosLey, valorSeguro } from '../../core/api';
import { Avisos } from '../../core/avisos';
import { DineroPipe } from '../../core/dinero.pipe';
import type { DatosEmpleado, Empleado, Grado, Puesto } from '../../core/modelos';

/** Familia de un nivel de la tabla: la letra con la que empieza («B» para «B2: Supervisión técnica»). */
const familiaDeNivel = (g: Grado) => g.denominacion.trim().charAt(0).toUpperCase();

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
            <label for="regimen">Régimen laboral</label>
            <select class="entrada" id="regimen" formControlName="regimen">
              @for (r of parametros()?.regimenes; track r.codigo) {
                <option [value]="r.codigo">{{ r.nombre }}</option>
              }
            </select>
            @if (regimenElegido(); as r) {
              <span class="ayuda">
                {{ r.descripcion }}
                @if (!r.verificado) { <strong>Algunos valores de este régimen están por confirmar.</strong> }
              </span>
            }
          </div>
          @if (esMixto()) {
            <div class="campo c3">
              <label for="categoriaLoep">Categoría en la empresa pública</label>
              <select class="entrada" id="categoriaLoep" formControlName="categoriaLoep">
                <option value="">Elige una categoría</option>
                <option value="servidor">Servidor público (se rige por la LOSEP)</option>
                <option value="obrero">Obrero (se rige por el Código del Trabajo)</option>
              </select>
              <span class="ayuda">La categoría decide qué reglas se aplican en el rol.</span>
            </div>
          }
          @if (usaPuestos()) {
            <div class="campo c6">
              <label for="puestoId">Puesto en el orgánico</label>
              <select class="entrada" id="puestoId" formControlName="puestoId"
                      (change)="elegirPuesto($any($event.target).value)">
                <option value="">Elige un puesto</option>
                @for (p of puestosDelRegimen(); track p.id) {
                  <option [value]="p.id">{{ p.nombre }}</option>
                }
              </select>
              @if (puestoElegido(); as p) {
                <dl class="ficha-puesto">
                  <dt>Función</dt><dd>{{ p.funcion }}</dd>
                  <dt>Responsabilidad</dt><dd>{{ p.responsabilidad }}</dd>
                  <dt>Sector económico</dt><dd>{{ p.sector }}</dd>
                  <dt>Referencia salarial</dt>
                  <dd>
                    @if (p.referencia; as r) {
                      {{ r.denominacion }}: mínimo {{ r.rmu | dinero }}
                      @if (r.rmuMax) { (según la rama, hasta {{ r.rmuMax | dinero }}) }
                    }
                  </dd>
                </dl>
              } @else {
                <span class="ayuda">
                  Primero se identifica el puesto: de él salen la función, la responsabilidad, el sector y el
                  nivel salarial de referencia. Después se asigna el sueldo.
                </span>
              }
            </div>
          }
          @if (exigeGrado()) {
            <div class="campo c6">
              <label for="escalaId">{{ usaPuestos() ? 'Nivel que le toca (tabla salarial)' : 'Grado de la escala salarial' }}</label>
              <select class="entrada" id="escalaId" formControlName="escalaId"
                      (change)="elegirGrado($any($event.target).value)">
                <option value="">Elige un grado de la tabla</option>
                @for (g of opcionesGrado(); track g.id) {
                  <option [value]="g.id">
                    Grado {{ g.grado }}: {{ g.denominacion }}
                    ({{ g.esMinimo ? 'mínimo ' : '' }}{{ g.rmu | dinero }}{{ g.rmuMax ? ' a ' + (g.rmuMax | dinero) : '' }})
                  </option>
                }
              </select>
              <span class="ayuda">
                @if (usaPuestos()) {
                  Viene del puesto, pero puedes elegir otro nivel de la tabla si al trabajador le toca uno distinto.
                } @else {
                  El grado fija el sueldo que se paga, según la tabla.
                }
              </span>
            </div>
          }
          @if (gradoElegido(); as g) {
            <p class="ayuda c6">
              @if (g.esMinimo) {
                El sueldo no puede ser menor a {{ g.rmu | dinero }}, el mínimo de este nivel. Puede ser mayor.
              } @else {
                El sueldo es la remuneración del grado, según la tabla.
              }
            </p>
          }
          <div class="campo c3">
            <label for="sueldoBase">Sueldo base (USD)</label>
            <input class="entrada num" id="sueldoBase" type="number" step="0.01"
                   formControlName="sueldoBase" [readOnly]="exigeGrado() && !gradoElegido()?.esMinimo"
                   [min]="gradoElegido()?.esMinimo ? gradoElegido()!.rmu : 0.01" />
            @if (parametros(); as p) {
              <span class="ayuda">El sueldo básico unificado de {{ p.anio }} es {{ p.sbu | dinero }}.</span>
            }
          </div>
          <div class="campo c3">
            <label for="fechaIngreso">Fecha de ingreso</label>
            <input class="entrada" id="fechaIngreso" type="date" formControlName="fechaIngreso" />
            <span class="ayuda">Si ingresa a mitad de mes, el primer rol paga solo los días trabajados.</span>
          </div>
          <fieldset class="campo c6 beneficios">
            <legend>Beneficios de este empleado</legend>
            <p class="ayuda">
              Si no cambias nada, se aplica lo que diga el régimen: los décimos y los fondos de reserva se pagan
              cada mes en el rol, y las horas extras se pagan. Cámbialo si el trabajador pidió acumularlos o no
              los recibe.
            </p>
            <div class="rejilla-beneficios">
              @for (b of beneficios; track b.control) {
                <div class="campo">
                  <label [for]="b.control">{{ b.etiqueta }}</label>
                  <select class="entrada" [id]="b.control" [formControlName]="b.control">
                    <option value="">Según el régimen</option>
                    <option value="mensual">Se paga cada mes en el rol</option>
                    <option value="acumulado">Lo acumula (el empleador lo provisiona)</option>
                    <option value="no">No lo recibe</option>
                  </select>
                </div>
              }
              <div class="campo">
                <label for="recibeHorasExtras">Horas extras</label>
                <select class="entrada" id="recibeHorasExtras" formControlName="recibeHorasExtras">
                  <option value="">Según el régimen</option>
                  <option value="si">Las recibe</option>
                  <option value="no">No las recibe</option>
                </select>
              </div>
            </div>
          </fieldset>
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
    regimen: ['CODIGO_TRABAJO', Validators.required],
    categoriaLoep: [''],
    escalaId: [''],
    puestoId: [''],
    pagoDecimoTercero: [''],
    pagoDecimoCuarto: [''],
    pagoFondosReserva: [''],
    recibeHorasExtras: [''],
    sueldoBase: [null as number | null, [Validators.required, Validators.min(0.01)]],
    fechaIngreso: ['', Validators.required],
  });

  protected readonly beneficios = [
    { control: 'pagoDecimoTercero', etiqueta: 'Décimo tercero' },
    { control: 'pagoDecimoCuarto', etiqueta: 'Décimo cuarto' },
    { control: 'pagoFondosReserva', etiqueta: 'Fondos de reserva' },
  ] as const;

  private readonly regimenSeleccionado = toSignal(this.form.controls.regimen.valueChanges, {
    initialValue: this.form.controls.regimen.value,
  });
  protected readonly regimenElegido = computed(() =>
    this.parametros()?.regimenes.find((r) => r.codigo === this.regimenSeleccionado()),
  );
  protected readonly esMixto = computed(() => this.regimenElegido()?.tipo === 'mixto');

  private readonly categoriaSeleccionada = toSignal(this.form.controls.categoriaLoep.valueChanges, {
    initialValue: this.form.controls.categoriaLoep.value,
  });
  /** Régimen cuyas reglas (y escala) se aplican: en la LOEP lo decide la categoría. */
  private readonly regimenQueSeAplica = computed(() => {
    const r = this.regimenElegido();
    if (r?.tipo !== 'mixto') return r?.codigo;
    return this.categoriaSeleccionada() === 'obrero' ? r.regimenObrero : r.regimenServidor;
  });

  private readonly puestos = valorSeguro(httpResource<Puesto[]>(() => '/api/puestos'));
  /** Puestos cuya referencia salarial es la escala del régimen que se aplica. */
  protected readonly puestosDelRegimen = computed(() => {
    const aplicado = this.regimenQueSeAplica();
    return (this.puestos() ?? []).filter((p) => p.referencia?.regimen === aplicado);
  });
  protected readonly usaPuestos = computed(() => this.puestosDelRegimen().length > 0);
  private readonly puestoId = toSignal(this.form.controls.puestoId.valueChanges, {
    initialValue: this.form.controls.puestoId.value,
  });
  protected readonly puestoElegido = computed(() =>
    this.puestosDelRegimen().find((p) => String(p.id) === this.puestoId()),
  );

  /**
   * Los grados del select. Sin puestos, todos los de la escala. Con puestos, solo los de la misma familia
   * de niveles que la referencia del puesto elegido (si es B3: B1, B2 y B3), y ninguno mientras no haya puesto.
   * El grado que ya tiene el empleado siempre se ofrece, para no perderlo al editar.
   */
  protected readonly opcionesGrado = computed(() => {
    const todos = this.grados();
    if (!this.usaPuestos()) return todos;
    const referencia = this.puestoElegido()?.referencia;
    const actual = this.gradoId();
    const familia = referencia ? familiaDeNivel(referencia) : null;
    return todos.filter((g) => (familia !== null && familiaDeNivel(g) === familia) || String(g.id) === actual);
  });

  private readonly escala = valorSeguro(httpResource<Grado[]>(() => '/api/escala'));
  protected readonly grados = computed(() => {
    const aplicado = this.regimenQueSeAplica();
    return (this.escala() ?? []).filter((g) => g.regimen === aplicado);
  });

  private readonly gradoId = toSignal(this.form.controls.escalaId.valueChanges, {
    initialValue: this.form.controls.escalaId.value,
  });
  protected readonly gradoElegido = computed(() => this.grados().find((g) => String(g.id) === this.gradoId()));

  /** Si el régimen aplicado tiene escala, el grado es obligatorio y fija el sueldo. */
  protected readonly exigeGrado = computed(() => this.grados().length > 0);

  private readonly actual = valorSeguro(
    httpResource<Empleado>(() => (this.id() ? `/api/empleados/${this.id()}` : undefined)),
  );

  constructor() {
    // Al llegar el empleado a editar, se llenan los campos.
    effect(() => {
      const e = this.actual();
      if (e) {
        this.form.patchValue({
          ...e,
          categoriaLoep: e.categoriaLoep ?? '',
          escalaId: e.escalaId ? String(e.escalaId) : '',
          puestoId: e.puestoId ? String(e.puestoId) : '',
          pagoDecimoTercero: e.pagoDecimoTercero ?? '',
          pagoDecimoCuarto: e.pagoDecimoCuarto ?? '',
          pagoFondosReserva: e.pagoFondosReserva ?? '',
          recibeHorasExtras: e.recibeHorasExtras === null ? '' : e.recibeHorasExtras ? 'si' : 'no',
        });
      }
    });

    // Si el régimen cambia y el puesto elegido ya no es de su orgánico, se quita (con su grado, sueldo y cargo).
    effect(() => {
      const puestos = this.puestosDelRegimen();
      if (!this.puestos()) return;
      const actual = this.form.controls.puestoId.value;
      if (actual && !puestos.some((p) => String(p.id) === actual)) this.form.controls.puestoId.setValue('');
    });

    // Si el régimen cambia y el grado elegido ya no pertenece a su escala, se quita.
    effect(() => {
      const grados = this.grados();
      if (!this.escala()) return;
      const actual = this.form.controls.escalaId.value;
      if (actual && !grados.some((g) => String(g.id) === actual)) {
        this.form.controls.escalaId.setValue('');
        this.form.controls.sueldoBase.setValue(null); // el sueldo venía del grado que se quitó
        this.soltarCargoPropuesto();
      }
    });
  }

  /** Elegir un grado propone su remuneración como sueldo y su denominación como cargo. */
  protected elegirGrado(valor: string) {
    const grado = this.grados().find((g) => String(g.id) === valor);
    if (!grado) {
      this.form.controls.sueldoBase.setValue(null);
      if (!this.usaPuestos()) this.soltarCargoPropuesto();
      return;
    }
    this.form.controls.sueldoBase.setValue(grado.rmu);
    // Con puestos, el cargo es el del puesto: el nivel solo cambia el sueldo.
    if (!this.usaPuestos()) this.proponerCargo(grado.denominacion);
  }

  /** El cargo se reemplaza solo si está vacío o si es el que propuso la elección anterior: uno escrito a mano se respeta. */
  private proponerCargo(texto: string) {
    const cargo = this.form.controls.cargo;
    if (!cargo.value.trim() || cargo.value === this.cargoPropuesto) cargo.setValue(texto);
    this.cargoPropuesto = texto;
  }

  /** Elegir un puesto fija el grado de su referencia, propone el sueldo mínimo y el nombre como cargo. */
  protected elegirPuesto(valor: string) {
    const puesto = this.puestosDelRegimen().find((p) => String(p.id) === valor);
    if (!puesto?.referencia) {
      this.form.controls.escalaId.setValue('');
      this.form.controls.sueldoBase.setValue(null);
      this.soltarCargoPropuesto();
      return;
    }
    this.form.controls.escalaId.setValue(String(puesto.referencia.id));
    this.form.controls.sueldoBase.setValue(puesto.referencia.rmu);
    this.proponerCargo(puesto.nombre);
  }

  /** Denominación que el último grado puso en el cargo, para saber si el usuario la cambió. */
  private cargoPropuesto = '';

  /** Si el grado se quita, el cargo que él había propuesto se quita también. */
  private soltarCargoPropuesto() {
    if (this.form.controls.cargo.value === this.cargoPropuesto) this.form.controls.cargo.setValue('');
    this.cargoPropuesto = '';
  }

  protected async guardar() {
    this.avisos.limpiar();
    const {
      categoriaLoep, escalaId, puestoId, pagoDecimoTercero, pagoDecimoCuarto, pagoFondosReserva, recibeHorasExtras,
      ...resto
    } = this.form.getRawValue();
    if (this.esMixto() && !categoriaLoep) {
      this.avisos.error('Elige si el empleado es servidor u obrero.');
      return;
    }
    if (this.usaPuestos() && !puestoId) {
      this.avisos.error('Elige el puesto del orgánico: de él sale el nivel salarial de referencia.');
      return;
    }
    if (this.exigeGrado() && !escalaId) {
      this.avisos.error('Elige un grado de la escala salarial: el sueldo sale de la tabla.');
      return;
    }
    const nivel = this.gradoElegido();
    if (nivel?.esMinimo && (resto.sueldoBase ?? 0) < nivel.rmu) {
      this.avisos.error(`El sueldo no puede ser menor al mínimo del nivel (${nivel.rmu} USD).`);
      return;
    }
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.avisos.error('Completa todos los campos antes de guardar.');
      return;
    }
    const datos = {
      ...resto,
      categoriaLoep: this.esMixto() ? categoriaLoep : null,
      escalaId: escalaId ? Number(escalaId) : null,
      puestoId: this.usaPuestos() && puestoId ? Number(puestoId) : null,
      pagoDecimoTercero: pagoDecimoTercero || null,
      pagoDecimoCuarto: pagoDecimoCuarto || null,
      pagoFondosReserva: pagoFondosReserva || null,
      recibeHorasExtras: recibeHorasExtras === '' ? null : recibeHorasExtras === 'si',
    } as DatosEmpleado;
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
