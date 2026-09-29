import { randomInt } from 'node:crypto';

// Niente O, I, L, 0, 1: si confondono quando il codice si legge ad alta voce.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LENGTH = 8;

export function generateJoinCode(): string {
  let code = '';
  for (let i = 0; i < LENGTH; i++) code += ALPHABET[randomInt(ALPHABET.length)];
  return code;
}

export function isValidJoinCode(value: string): boolean {
  return value.length === LENGTH && [...value].every((char) => ALPHABET.includes(char));
}

// Un codice digitato a mano arriva in minuscolo, con spazi o trattini: si riporta alla
// forma canonica prima di validarlo.
export function normalizeJoinCode(value: string): string {
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    return value;
  }
  return decoded.replace(/[\s-]/g, '').toUpperCase();
}
