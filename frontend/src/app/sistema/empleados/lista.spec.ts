import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { Empleado } from '../../core/modelos';
import { ListaEmpleados } from './lista';

const ANA: Empleado = {
  id: 1, cedula: '1801234566', nombres: 'Ana Prueba', cargo: 'Analista', sueldoBase: 1000,
  fechaIngreso: '2024-01-10', tipoContrato: 'Indefinido', regimen: 'CODIGO_TRABAJO', categoriaLoep: null, escalaId: null,
  activo: true,
};

describe('ListaEmpleados', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const cargar = async (empleados: Empleado[]) => {
    const fixture = TestBed.createComponent(ListaEmpleados);
    fixture.detectChanges();
    TestBed.tick(); // el recurso emite su petición al correr los efectos
    http.expectOne('/api/parametros').flush({ regimenes: [{ codigo: 'CODIGO_TRABAJO', nombre: 'Código del Trabajo' }] });
    http.expectOne('/api/empleados').flush(empleados);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  it('lista a los empleados con su sueldo y estado', async () => {
    const { el } = await cargar([ANA, { ...ANA, id: 2, nombres: 'Luis Inactivo', activo: false }]);
    const filas = el.querySelectorAll('tbody tr');
    expect(filas.length).toBe(2);
    expect(filas[0].textContent).toContain('Ana Prueba');
    expect(filas[0].textContent).toContain('$1,000.00');
    expect(filas[0].textContent).toContain('Activo');
    expect(filas[0].textContent).toContain('Código del Trabajo');
    expect(filas[1].textContent).toContain('Inactivo');
  });

  it('sin empleados invita a agregar o cargar los de ejemplo', async () => {
    const { el } = await cargar([]);
    expect(el.textContent).toContain('Todavía no hay empleados');
    expect(el.textContent).toContain('Cargar datos de ejemplo');
  });

  it('desactivar llama a la API y recarga la lista', async () => {
    const { fixture, el } = await cargar([ANA]);
    const boton = [...el.querySelectorAll('button')].find((b) => b.textContent?.includes('Desactivar'))!;
    boton.click();

    const patch = http.expectOne('/api/empleados/1/estado');
    expect(patch.request.method).toBe('PATCH');
    patch.flush({ ...ANA, activo: false });
    await new Promise((resolver) => setTimeout(resolver)); // el componente recarga la lista
    TestBed.tick();

    http.expectOne('/api/empleados').flush([{ ...ANA, activo: false }]);
    await fixture.whenStable();
    fixture.detectChanges();
    expect(el.querySelector('tbody')?.textContent).toContain('Inactivo');
  });

  it('si el servidor falla, lo dice y permite reintentar', async () => {
    const fixture = TestBed.createComponent(ListaEmpleados);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/parametros').flush({ regimenes: [] });
    http.expectOne('/api/empleados').flush('error', { status: 500, statusText: 'Server Error' });
    await fixture.whenStable();
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No se pudo cargar la lista');
  });
});
