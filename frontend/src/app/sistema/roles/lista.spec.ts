import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import type { RolCabecera } from '../../core/modelos';
import { ListaRoles } from './lista';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

describe('ListaRoles', () => {
  let http: HttpTestingController;
  const hoy = new Date();

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const cargar = async (roles: RolCabecera[]) => {
    const fixture = TestBed.createComponent(ListaRoles);
    fixture.detectChanges();
    TestBed.tick();
    http.expectOne('/api/parametros').flush({ meses: MESES });
    http.expectOne('/api/roles').flush(roles);
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('muestra los doce meses y marca el actual', async () => {
    const el = await cargar([]);
    const meses = el.querySelectorAll('.mes');
    expect(meses.length).toBe(12);
    expect(el.querySelector('.mes-toca')?.textContent).toContain(MESES[hoy.getMonth()]);
  });

  it('un mes con rol abre el rol y uno sin rol abre las novedades', async () => {
    const anio = hoy.getFullYear();
    const rol: RolCabecera = {
      id: 9, anio, mes: 1, generadoEn: '', numEmpleados: 2, totalIngresos: 0, totalDescuentos: 0,
      totalNeto: 1500, totalProvisiones: 0, totalCosto: 0,
    };
    const el = await cargar([rol]);
    const enlaces = el.querySelectorAll('.mes');
    expect(enlaces[0].getAttribute('href')).toBe('/sistema/roles/9');
    expect(enlaces[0].textContent).toContain('$1,500.00');
    expect(enlaces[1].getAttribute('href')).toBe(`/sistema/roles/novedades/${anio}/2`);
  });

  it('cambiar de año recalcula el calendario', async () => {
    const el = await cargar([]);
    const siguiente = [...el.querySelectorAll('.cambio-anio button')][1] as HTMLButtonElement;
    siguiente.click();
    TestBed.tick();
    expect(el.querySelector('.cambio-anio strong')?.textContent).toContain(String(hoy.getFullYear() + 1));
    expect(el.querySelector('.mes-toca')).toBeNull();
  });
});
