let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext {
  if (!audioCtx) audioCtx = new AudioContext();
  return audioCtx;
}

function beep(frequency: number, duration: number, volume = 0.3): void {
  const ctx = getCtx();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.frequency.value = frequency;
  gain.gain.value = volume;
  osc.start();
  osc.stop(ctx.currentTime + duration / 1000);
}

export function playWarningSound(): void {
  beep(880, 200);
}

export function playCriticalSound(): void {
  beep(1200, 150);
  setTimeout(() => beep(1200, 150), 250);
  setTimeout(() => beep(1200, 150), 500);
}

let criticalInterval: ReturnType<typeof setInterval> | null = null;

export function startCriticalAlarm(): void {
  if (criticalInterval) return;
  playCriticalSound();
  criticalInterval = setInterval(playCriticalSound, 10000);
}

export function stopCriticalAlarm(): void {
  if (criticalInterval) {
    clearInterval(criticalInterval);
    criticalInterval = null;
  }
}
