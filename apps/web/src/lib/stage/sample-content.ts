// I pulsanti «di prova» del vassoio servono ai test del palco con il provider finto.
// Con l'agente vero spariscono: davanti a un cliente niente dati inventati.
export function showSampleContent(provider: 'anthropic' | 'fake'): boolean {
  return provider === 'fake';
}
