import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { GRUPOS_FUENTES, TOTAL_FUENTES } from '../core/fuentes';
import { routes } from '../app.routes';
import { Informacion } from './informacion';

describe('Informacion', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  const abrir = () => {
    const fixture = TestBed.createComponent(Informacion);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  };

  it('tiene las tres secciones: acerca de, investigación y fuentes', () => {
    const el = abrir();
    expect(el.querySelector('#acerca h2')?.textContent).toContain('Acerca de');
    expect(el.querySelector('#investigacion h2')?.textContent).toContain('Lo que encontró la investigación');
    expect(el.querySelector('#fuentes h2')?.textContent).toContain('Fuentes consultadas');
  });

  it('cada requisito de la guía tiene su fila con cómo se cumple', () => {
    const el = abrir();
    const filas = [...el.querySelectorAll('#acerca tbody tr')].map((f) => f.textContent ?? '');
    expect(filas.length).toBe(8);
    for (const tema of ['régimen laboral', 'Salario básico', 'Escala salarial', 'décimo tercero', 'horas extras', 'IESS']) {
      expect(filas.some((f) => f.toLowerCase().includes(tema.toLowerCase()))).toBe(true);
    }
  });

  it('lista lo que queda por confirmar, empezando por el aporte del sector público', () => {
    const el = abrir();
    const tarjetas = [...el.querySelectorAll('.tarjeta')].map((t) => t.textContent ?? '');
    expect(tarjetas.length).toBe(5);
    expect(tarjetas[0]).toContain('Aporte al IESS de los servidores públicos');
    expect(tarjetas.some((t) => t.includes('Escala salarial'))).toBe(true);
  });

  it('muestra un enlace por cada fuente, abierto en otra pestaña y sin pasar el origen', () => {
    const el = abrir();
    const enlaces = [...el.querySelectorAll<HTMLAnchorElement>('#fuentes .lista-fuentes a')];
    expect(enlaces.length).toBe(TOTAL_FUENTES);
    for (const a of enlaces) {
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toContain('noopener');
      expect(a.getAttribute('href')).toMatch(/^https?:\/\//);
    }
  });

  it('agrupa las fuentes y marca las que se leyeron completas', () => {
    const el = abrir();
    expect(el.querySelectorAll('.grupo-fuentes').length).toBe(GRUPOS_FUENTES.length);
    const leidas = GRUPOS_FUENTES.flatMap((g) => g.fuentes).filter((f) => f.leida).length;
    expect(el.querySelectorAll('.etiqueta-leida').length).toBe(leidas);
    expect(leidas).toBeGreaterThanOrEqual(3);
  });

  it('el botón de la barra y el del cierre llevan al sistema', () => {
    const el = abrir();
    const botones = [...el.querySelectorAll('a')].filter((a) => a.textContent?.includes('Ingresar al sistema'));
    expect(botones.length).toBe(2);
    for (const b of botones) expect(b.getAttribute('href')).toBe('/sistema');
  });
});

describe('fuentes de la investigación', () => {
  const todas = GRUPOS_FUENTES.flatMap((g) => g.fuentes);

  it('no repite ningún enlace', () => {
    const urls = todas.map((f) => f.url);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it('cada fuente dice qué dato se tomó de ella', () => {
    for (const f of todas) {
      expect(f.titulo.length).toBeGreaterThan(5);
      expect(f.uso.length).toBeGreaterThan(10);
    }
  });

  it('incluye los textos de las tres normas', () => {
    const normas = GRUPOS_FUENTES.find((g) => g.id === 'normas')!.fuentes.map((f) => f.titulo).join(' ');
    expect(normas).toContain('LOSEP');
    expect(normas).toContain('Código del Trabajo');
    expect(normas).toContain('LOEP');
  });
});
