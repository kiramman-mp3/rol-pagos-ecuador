import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    title: 'Rol de pagos Ecuador 2026',
    loadComponent: () => import('./landing/landing').then((m) => m.Landing),
  },
  {
    path: 'informacion',
    title: 'Información | Rol de pagos Ecuador',
    loadComponent: () => import('./informacion/informacion').then((m) => m.Informacion),
  },
  {
    path: 'sistema',
    loadComponent: () => import('./sistema/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'empleados' },
      {
        path: 'empleados',
        title: 'Empleados | Rol de pagos',
        loadComponent: () => import('./sistema/empleados/lista').then((m) => m.ListaEmpleados),
      },
      {
        path: 'empleados/nuevo',
        title: 'Nuevo empleado | Rol de pagos',
        loadComponent: () =>
          import('./sistema/empleados/formulario').then((m) => m.FormularioEmpleado),
      },
      {
        path: 'empleados/:id/editar',
        title: 'Editar empleado | Rol de pagos',
        loadComponent: () =>
          import('./sistema/empleados/formulario').then((m) => m.FormularioEmpleado),
      },
      {
        path: 'organico',
        title: 'Orgánico funcional | Rol de pagos',
        loadComponent: () => import('./sistema/organico/organico').then((m) => m.Organico),
      },
      {
        path: 'parametros',
        title: 'Parámetros | Rol de pagos',
        loadComponent: () => import('./sistema/parametros/parametros').then((m) => m.PaginaParametros),
      },
      {
        path: 'roles',
        title: 'Roles de pago | Rol de pagos',
        loadComponent: () => import('./sistema/roles/lista').then((m) => m.ListaRoles),
      },
      {
        path: 'roles/novedades/:anio/:mes',
        title: 'Novedades del mes | Rol de pagos',
        loadComponent: () => import('./sistema/roles/novedades').then((m) => m.NovedadesMes),
      },
      {
        path: 'roles/:id',
        title: 'Rol de pagos | Rol de pagos',
        loadComponent: () => import('./sistema/roles/detalle').then((m) => m.DetalleRol),
      },
      {
        path: 'roles/:id/boleta/:detalleId',
        title: 'Boleta | Rol de pagos',
        loadComponent: () => import('./sistema/roles/boleta').then((m) => m.Boleta),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
