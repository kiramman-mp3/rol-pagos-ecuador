import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import type { Grado, Puesto } from '../../core/modelos';
import { Organico } from './organico';

const NIVEL_A: Grado = {
  id: 1, regimen: 'CODIGO_TRABAJO', grado: 1, denominacion: 'A: Jefatura', rmu: 510, rmuMax: 1280, esMinimo: true, fuente: '',
};
const NIVEL_B1: Grado = {
  id: 2, regimen: 'CODIGO_TRABAJO', grado: 2, denominacion: 'B1: Supervisión general', rmu: 495, rmuMax: 842, esMinimo: true, fuente: '',
};

const puesto = (id: number, nombre: string, superiorId: number | null, referencia: Grado | null): Puesto => ({
  id, nombre, superiorId, funcion: `Función de ${nombre}.`, responsabilidad: `Responsabilidad de ${nombre}.`,
  sector: 'Servicios', escalaId: referencia?.id ?? null, referencia, empleados: id === 2 ? 2 : 0,
  responsable: id === 2 ? { id: 7, nombres: 'José Gabriel Manzano' } : null,
  ocupantes: id === 2 ? [{ id: 7, nombres: 'José Gabriel Manzano' }, { id: 8, nombres: 'Rosa Prueba' }] : [],
});

// Se entregan desordenados a propósito: el orgánico debe leerse de arriba abajo.
const PUESTOS = [
  puesto(3, 'Supervisor de instalaciones', 2, NIVEL_B1),
  puesto(1, 'Gerente / Propietario', null, NIVEL_A),
  puesto(2, 'Administrador / Contador', 1, NIVEL_B1),
];

describe('Organico', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
  });

  const abrir = async () => {
    const fixture = TestBed.createComponent(Organico);
    fixture.detectChanges();
    http.expectOne('/api/puestos').flush(PUESTOS);
    http.expectOne('/api/escala').flush([NIVEL_A, NIVEL_B1]);
    await fixture.whenStable();
    fixture.detectChanges();
    return { fixture, el: fixture.nativeElement as HTMLElement };
  };

  const escribir = (el: HTMLElement, selector: string, valor: string) => {
    const campo = el.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)!;
    campo.value = valor;
    campo.dispatchEvent(new Event('input'));
    campo.dispatchEvent(new Event('change'));
  };

  it('muestra los puestos de arriba abajo, sangrando a los subordinados', async () => {
    const { el } = await abrir();
    const puestos = [...el.querySelectorAll<HTMLElement>('article.puesto')];
    expect(puestos.map((p) => p.querySelector('h3')!.textContent?.trim())).toEqual([
      'Gerente / Propietario', 'Administrador / Contador', 'Supervisor de instalaciones',
    ]);
    expect(puestos[0].style.marginLeft).toBe('0rem');
    expect(puestos[1].style.marginLeft).toBe('1.75rem');
    expect(puestos[2].style.marginLeft).toBe('3.5rem');
  });

  it('cada puesto trae función, responsabilidad, sector y referencia salarial', async () => {
    const { el } = await abrir();
    const gerente = el.querySelector('article.puesto')!.textContent!;
    expect(gerente).toContain('Función de Gerente / Propietario.');
    expect(gerente).toContain('Responsabilidad de Gerente / Propietario.');
    expect(gerente).toContain('Servicios');
    expect(gerente).toContain('A: Jefatura');
    expect(gerente).toContain('mínimo');
    expect(el.textContent).toContain('2 empleados');
  });

  it('muestra el nombre del responsable de cada puesto o que no lo tiene', async () => {
    const { el } = await abrir();
    const [gerente, administrador] = [...el.querySelectorAll<HTMLElement>('article.puesto')];
    expect(gerente.querySelector('.responsable')!.textContent).toContain('Sin responsable asignado');
    expect(administrador.querySelector('.responsable strong')!.textContent).toBe('José Gabriel Manzano');
    expect(gerente.textContent).toContain('Nadie ocupa este puesto todavía');
  });

  it('el select de responsable ofrece solo a quienes ocupan el puesto y guarda el cambio', async () => {
    const { fixture, el } = await abrir();
    const opciones = [...el.querySelectorAll('#responsable-2 option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Sin responsable', 'José Gabriel Manzano', 'Rosa Prueba']);
    expect(el.querySelector('#responsable-1')).toBeNull(); // nadie ocupa el puesto 1

    escribir(el, '#responsable-2', '8');
    fixture.detectChanges();
    const envio = http.expectOne('/api/puestos/2/responsable');
    expect(envio.request.method).toBe('PATCH');
    expect(envio.request.body).toEqual({ empleadoId: 8 });
    envio.flush({ ...PUESTOS[2], responsable: { id: 8, nombres: 'Rosa Prueba' } });
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.tick();
    const recarga = http.match('/api/puestos');
    expect(recarga.length).toBe(1); // se vuelve a pedir el orgánico
    recarga[0].flush(PUESTOS);
  });

  it('al editar, un puesto no se ofrece a sí mismo ni a sus subordinados como superior', async () => {
    const { fixture, el } = await abrir();
    el.querySelectorAll<HTMLButtonElement>('article.puesto .boton-texto')[0].click(); // editar al gerente
    fixture.detectChanges();
    const opciones = [...el.querySelectorAll('#puesto-superior option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Nadie: es la cabeza del orgánico']);
  });

  it('agrega un puesto con su superior y su referencia salarial', async () => {
    const { fixture, el } = await abrir();
    escribir(el, '#puesto-nombre', 'Operaciones de instalaciones');
    escribir(el, '#puesto-superior', '2');
    escribir(el, '#puesto-funcion', 'Ejecutar instalaciones.');
    escribir(el, '#puesto-responsabilidad', 'Responde por el trabajo asignado.');
    escribir(el, '#puesto-sector', 'Servicios');
    escribir(el, '#puesto-escala', '2');
    fixture.detectChanges();

    el.querySelector('form')!.dispatchEvent(new Event('submit'));
    const envio = http.expectOne('/api/puestos');
    expect(envio.request.method).toBe('POST');
    expect(envio.request.body).toEqual({
      nombre: 'Operaciones de instalaciones', superiorId: 2, funcion: 'Ejecutar instalaciones.',
      responsabilidad: 'Responde por el trabajo asignado.', sector: 'Servicios', escalaId: 2,
    });
    envio.flush(PUESTOS[0]);
    await new Promise((resolver) => setTimeout(resolver));
    http.match('/api/puestos').forEach((r) => r.flush(PUESTOS));
  });
});
