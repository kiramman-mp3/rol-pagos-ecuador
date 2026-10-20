/** Escritura de CSV que Excel abre bien. */

// Excel abre el CSV en UTF-8 solo si empieza con esta marca.
export const BOM = String.fromCharCode(0xfeff);

export const celdaCsv = (valor: unknown) => {
  const texto = String(valor ?? "");
  return /[",\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
};

/** Encabezado y filas listos para enviar, con la marca de UTF-8 al inicio. */
export function documentoCsv(encabezado: string[], filas: unknown[][]): string {
  const lineas = [encabezado, ...filas].map((fila) => fila.map(celdaCsv).join(","));
  return `${BOM}${lineas.join("\n")}\n`;
}
