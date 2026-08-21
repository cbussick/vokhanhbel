interface PlaybackParticipant {
  stop: () => void;
}

let currentParticipant: PlaybackParticipant | undefined;

export function beginPlayback(participant: PlaybackParticipant): void {
  if (currentParticipant !== participant) currentParticipant?.stop();
  currentParticipant = participant;
}

export function endPlayback(participant: PlaybackParticipant): void {
  if (currentParticipant === participant) currentParticipant = undefined;
}

export function stopApplicationPlayback(): void {
  currentParticipant?.stop();
  currentParticipant = undefined;
}
