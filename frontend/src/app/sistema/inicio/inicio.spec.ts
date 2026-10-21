import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Empleado, RolCabecera } from '../../core/modelos';
import { Inicio } from './inicio';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

const ANA = { id: 1, nombres: 'Ana Prueba', activo: true } as Empleado;

describe('Inicio', () => {
  let http: HttpTestingController;
  const hoy = new Date();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const cargar = async (empleados: Empleado[], roles: RolCabecera[]) => {
    const fixture = TestBed.createComponent(Inicio);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/parametros').flush({ meses: MESES, empresa: { nombre: 'Casa Demo', ruc: '1' } });
    http.expectOne('/api/empleados').flush(empleados);
    http.expectOne('/api/roles').flush(roles);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  const rolDeEsteMes = (): RolCabecera => ({
    id: 7, anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, generadoEn: '', numEmpleados: 1,
    totalIngresos: 1000, totalDescuentos: 94.5, totalNeto: 905.5, totalProvisiones: 200, totalCosto: 1200,
  });

  it('sin empleados empieza por el equipo', async () => {
    const el = await cargar([], []);
    expect(el.querySelector('h1')?.textContent).toContain('Empecemos por tu equipo');
    expect(el.querySelector('.portada-mes a')?.getAttribute('href')).toBe('/sistema/empleados/nuevo');
    expect(el.querySelectorAll('.paso-actual').length).toBe(1);
  });

  it('con equipo y sin rol lleva a anotar las novedades del mes', async () => {
    const el = await cargar([ANA], []);
    expect(el.querySelector('h1')?.textContent).toContain(`Cerremos ${MESES[hoy.getMonth()]}`);
    expect(el.querySelector('.portada-mes a')?.getAttribute('href')).toBe(
      `/sistema/roles/novedades/${hoy.getFullYear()}/${hoy.getMonth() + 1}`,
    );
    expect(el.querySelectorAll('.paso-hecho').length).toBe(1);
  });

  it('con el rol del mes generado marca tres pasos y lleva a descargarlo', async () => {
    const el = await cargar([ANA], [rolDeEsteMes()]);
    expect(el.querySelector('h1')?.textContent).toContain('ya tiene rol');
    expect(el.querySelectorAll('.paso-hecho').length).toBe(3);
    expect(el.querySelector('.portada-mes a')?.getAttribute('href')).toBe('/sistema/roles/7');
    expect(el.textContent).toContain('$905.50');
  });
});
