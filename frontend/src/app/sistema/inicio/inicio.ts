import { httpResource } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ParametrosLey, valorSeguro } from '../../core/api';
import { DineroPipe } from '../../core/dinero.pipe';
import type { Empleado, RolCabecera } from '../../core/modelos';

type EstadoPaso = 'hecho' | 'actual' | 'pendiente';

interface Paso {
  titulo: string;
  detalle: string;
  estado: EstadoPaso;
  enlace: string[];
  accion: string;
}

/** Primera pantalla del sistema: en qué punto está el rol del mes y qué sigue. */
@Component({
  selector: 'app-inicio',
  imports: [RouterLink, DineroPipe],
  templateUrl: './inicio.html',
  styleUrl: './inicio.css',
})
export class Inicio {
  protected readonly parametros = inject(ParametrosLey).valor;
  private readonly dinero = new DineroPipe();

  private readonly recursoEmpleados = httpResource<Empleado[]>(() => '/api/empleados');
  private readonly recursoRoles = httpResource<RolCabecera[]>(() => '/api/roles');
  private readonly empleados = valorSeguro(this.recursoEmpleados);
  private readonly roles = valorSeguro(this.recursoRoles);

  private readonly hoy = new Date();
  protected readonly anio = this.hoy.getFullYear();
  protected readonly mes = this.hoy.getMonth() + 1;

  protected readonly cargando = computed(() => !this.empleados() || !this.roles());
  protected readonly fallo = computed(() => !!this.recursoEmpleados.error() || !!this.recursoRoles.error());

  protected readonly nombreMes = computed(() => this.parametros()?.meses[this.mes - 1] ?? '');
  protected readonly saludo = this.hoy.getHours() < 12 ? 'Buenos días' : this.hoy.getHours() < 19 ? 'Buenas tardes' : 'Buenas noches';

  protected readonly activos = computed(() => this.empleados()?.filter((e) => e.activo).length ?? 0);
  protected readonly inactivos = computed(() => this.empleados()?.filter((e) => !e.activo).length ?? 0);
  protected readonly rolDelMes = computed(() =>
    this.roles()?.find((r) => r.anio === this.anio && r.mes === this.mes),
  );
  protected readonly ultimoRol = computed(() => this.roles()?.[0]);

  protected readonly pasos = computed<Paso[]>(() => {
    const activos = this.activos();
    const rol = this.rolDelMes();
    const novedades = ['/sistema/roles/novedades', String(this.anio), String(this.mes)];

    const equipoListo = activos > 0;
    return [
      {
        titulo: 'Tu equipo',
        detalle: equipoListo
          ? `${activos} ${activos === 1 ? 'persona activa entra' : 'personas activas entran'} al rol.`
          : 'Aún no hay nadie registrado.',
        estado: equipoListo ? 'hecho' : 'actual',
        enlace: equipoListo ? ['/sistema/empleados'] : ['/sistema/empleados/nuevo'],
        accion: equipoListo ? 'Revisar equipo' : 'Agregar empleados',
      },
      {
        titulo: 'Novedades del mes',
        detalle: rol
          ? 'Las novedades ya se usaron en el rol.'
          : 'Horas extras, comisiones y anticipos. Lo que dejes en blanco cuenta como cero.',
        estado: rol ? 'hecho' : equipoListo ? 'actual' : 'pendiente',
        enlace: novedades,
        accion: rol ? 'Cambiar novedades' : 'Anotar novedades',
      },
      {
        titulo: 'Rol generado',
        detalle: rol
          ? `Neto a pagar de ${this.dinero.transform(rol.totalNeto)} para ${rol.numEmpleados} personas.`
          : 'Se calcula al terminar las novedades.',
        estado: rol ? 'hecho' : 'pendiente',
        enlace: rol ? ['/sistema/roles', String(rol.id)] : novedades,
        accion: rol ? 'Abrir el rol' : 'Ir a generar',
      },
      {
        titulo: 'Pagos e IESS',
        detalle: rol
          ? 'Imprime las boletas, descarga el CSV y concilia los aportes con el IESS.'
          : 'Boletas, archivo para Excel y aportes al IESS.',
        estado: rol ? 'actual' : 'pendiente',
        enlace: rol ? ['/sistema/roles', String(rol.id)] : ['/sistema/roles'],
        accion: rol ? 'Descargar y pagar' : 'Ver roles',
      },
    ];
  });

  /** La acción que más importa ahora: el primer paso que no está hecho. */
  protected readonly siguiente = computed(() => this.pasos().find((p) => p.estado === 'actual') ?? this.pasos()[3]);

  protected readonly titular = computed(() => {
    const rol = this.rolDelMes();
    if (!this.activos()) return 'Empecemos por tu equipo';
    return rol ? `${this.nombreMes()} ya tiene rol` : `Cerremos ${this.nombreMes()} ${this.anio}`;
  });

  protected readonly frase = computed(() => {
    const rol = this.rolDelMes();
    if (!this.activos()) return 'Registra a las personas que trabajan contigo y en minutos tendrás su rol.';
    if (rol) return 'Solo falta pagar y declarar. Si cambia algo, puedes recalcular el rol.';
    return 'Anota las novedades y el sistema calcula el IESS, el impuesto a la renta y los décimos por ti.';
  });
}
