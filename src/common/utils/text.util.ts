export function normalizeBasic(input: string): string {
  return (input ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9áéíóúñü\s]/giu, ' ')
    .replace(/\s+/g, ' ');
}
