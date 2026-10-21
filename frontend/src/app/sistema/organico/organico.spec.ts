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

  const cajas = (el: HTMLElement) => [...el.querySelectorAll<HTMLButtonElement>('button.caja-puesto')];

  it('dibuja el organigrama como árbol: cada puesto dentro de la lista de su superior', async () => {
    const { el } = await abrir();
    expect(cajas(el).map((c) => c.querySelector('.caja-nombre')!.textContent?.trim())).toEqual([
      'Gerente / Propietario', 'Administrador / Contador', 'Supervisor de instalaciones',
    ]);
    const raiz = el.querySelector('ul.arbol > li')!;
    expect(raiz.querySelector(':scope > button')!.textContent).toContain('Gerente / Propietario');
    const admin = raiz.querySelector(':scope > ul > li')!;
    expect(admin.querySelector(':scope > button')!.textContent).toContain('Administrador / Contador');
    expect(admin.querySelector(':scope > ul > li > button')!.textContent).toContain('Supervisor de instalaciones');
  });

  it('cada recuadro muestra el responsable o que no lo tiene, y el nivel salarial', async () => {
    const { el } = await abrir();
    const [gerente, administrador] = cajas(el);
    expect(gerente.querySelector('.caja-persona')!.textContent).toContain('Sin responsable');
    expect(gerente.querySelector('.caja-persona')!.classList).toContain('caja-vacia');
    expect(administrador.querySelector('.caja-persona')!.textContent).toBe('José Gabriel Manzano');
    expect(gerente.querySelector('.caja-nivel')!.textContent).toBe('A: Jefatura');
  });

  it('al abrir, el detalle es el de la cabeza del organigrama; al tocar otro recuadro cambia', async () => {
    const { fixture, el } = await abrir();
    const detalle = () => el.querySelector('.detalle-puesto')!;
    expect(detalle().querySelector('h2')!.textContent).toBe('Gerente / Propietario');
    expect(detalle().textContent).toContain('Función de Gerente / Propietario.');
    expect(detalle().textContent).toContain('Responsabilidad de Gerente / Propietario.');
    expect(detalle().textContent).toContain('Servicios');
    expect(detalle().textContent).toContain('A: Jefatura: mínimo');
    expect(detalle().textContent).toContain('Nadie. Asigna el puesto');
    expect(cajas(el)[0].classList).toContain('activa');

    cajas(el)[1].click();
    fixture.detectChanges();
    expect(detalle().querySelector('h2')!.textContent).toBe('Administrador / Contador');
    expect(detalle().textContent).toContain('depende de Gerente / Propietario');
    expect(detalle().textContent).toContain('2 empleados ocupan este puesto');
    expect(detalle().querySelector('.responsable strong')!.textContent).toBe('José Gabriel Manzano');
    expect(cajas(el)[1].classList).toContain('activa');
    expect(cajas(el)[0].classList).not.toContain('activa');
  });

  it('el select de responsable ofrece solo a quienes ocupan el puesto y guarda el cambio', async () => {
    const { fixture, el } = await abrir();
    expect(el.querySelector('#responsable-1')).toBeNull(); // nadie ocupa el puesto del gerente
    cajas(el)[1].click(); // el administrador sí tiene ocupantes
    fixture.detectChanges();
    const opciones = [...el.querySelectorAll('#responsable-2 option')].map((o) => o.textContent?.trim());
    expect(opciones).toEqual(['Sin responsable', 'José Gabriel Manzano', 'Rosa Prueba']);

    escribir(el, '#responsable-2', '8');
    fixture.detectChanges();
    const envio = http.expectOne('/api/puestos/2/responsable');
    expect(envio.request.method).toBe('PATCH');
    expect(envio.request.body).toEqual({ empleadoId: 8 });
    envio.flush({ ...PUESTOS[2], responsable: { id: 8, nombres: 'Rosa Prueba' } });
    await new Promise((resolver) => setTimeout(resolver));
    TestBed.tick();
    const recarga = http.match('/api/puestos');
    expect(recarga.length).toBe(1); // se vuelve a pedir el organigrama
    recarga[0].flush(PUESTOS);
  });

  it('al editar, un puesto no se ofrece a sí mismo ni a sus subordinados como superior', async () => {
    const { fixture, el } = await abrir();
    el.querySelector<HTMLButtonElement>('.detalle-puesto .boton-texto')!.click(); // editar al gerente, el puesto abierto
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
