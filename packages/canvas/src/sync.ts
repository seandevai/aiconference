import { applyCommand } from './reducer';
import type { StageMessage } from './schema';
import type { Stage, StageCommand } from './types';

// Scrittore unico (ARCHITECTURE §3.1): solo chi scrive incrementa version.
export function writeCommand(
  stage: Stage,
  command: StageCommand,
): { stage: Stage; message: StageMessage } | null {
  const next = applyCommand(stage, command);
  if (next === stage) return null;
  const version = stage.version + 1;
  return { stage: { ...next, version }, message: { type: 'command', version, command } };
}

export function followMessage(
  stage: Stage,
  message: StageMessage,
): { stage: Stage; outOfSync: boolean } {
  // Lo snapshot dello scrittore vince sempre: dopo una sua ripartenza la versione può calare.
  if (message.type === 'snapshot') return { stage: message.stage, outOfSync: false };
  // Versione diversa in qualunque verso: lo snapshot dello scrittore rimette tutto in ordine.
  if (message.type === 'heartbeat') return { stage, outOfSync: message.version !== stage.version };
  if (message.version <= stage.version) return { stage, outOfSync: false };
  if (message.version !== stage.version + 1) return { stage, outOfSync: true };
  return {
    stage: { ...applyCommand(stage, message.command), version: message.version },
    outOfSync: false,
  };
}
