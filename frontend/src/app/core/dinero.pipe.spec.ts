import { DineroPipe, sumar } from './dinero.pipe';

describe('DineroPipe', () => {
  const pipe = new DineroPipe();

  it('formatea dólares con separador de miles y dos decimales', () => {
    expect(pipe.transform(1234.5)).toBe('$1,234.50');
    expect(pipe.transform(0)).toBe('$0.00');
  });

  it('trata valores vacíos como cero', () => {
    expect(pipe.transform(null)).toBe('$0.00');
    expect(pipe.transform(undefined)).toBe('$0.00');
  });
});

describe('sumar', () => {
  it('evita los errores de coma flotante', () => {
    expect(0.1 + 0.2).not.toBe(0.3);
    expect(sumar([0.1, 0.2])).toBe(0.3);
  });

  it('suma una lista vacía como cero', () => {
    expect(sumar([])).toBe(0);
  });
});
