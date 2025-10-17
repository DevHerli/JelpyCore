import { normalizeBasic } from './text.util';

const BAD_WORDS = [
  'pendejo','p3ndejo','ching','ch1ng','madre','m4dre','puta','pvt','cabrón','cabron'
  // agrega las que necesites; idealmente carga de BD/config
];

export function containsProfanity(text: string): boolean {
  const t = normalizeBasic(text).replace(/\s+/g, '');
  return BAD_WORDS.some(bw => t.includes(normalizeBasic(bw)));
}
