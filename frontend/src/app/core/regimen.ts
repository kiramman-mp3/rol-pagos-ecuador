import type { Regimen } from './modelos';

/**
 * Nombre legible del régimen de un empleado. Para la LOEP agrega las reglas que se aplicaron:
 * "LOEP (empresas públicas) → LOSEP (servidores públicos)".
 */
export function etiquetaRegimen(
  regimenes: Regimen[] | undefined,
  codigo: string,
  aplicado?: string,
): string {
  const nombre = (c: string) => regimenes?.find((r) => r.codigo === c)?.nombre ?? c;
  return aplicado && aplicado !== codigo ? `${nombre(codigo)} → ${nombre(aplicado)}` : nombre(codigo);
}
