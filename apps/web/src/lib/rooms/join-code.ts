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
