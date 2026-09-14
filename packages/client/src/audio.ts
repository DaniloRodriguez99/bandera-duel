let context: AudioContext | undefined;
export let muted = localStorage.getItem('bandera-muted') === 'true';
export function unlockAudio() {
  if (!muted) {
    context ??= new AudioContext();
    void context.resume();
  }
}
export function toggleMute() {
  muted = !muted;
  localStorage.setItem('bandera-muted', String(muted));
  if (!muted) unlockAudio();
  return muted;
}
export function sound(kind: string) {
  if (muted || !context) return;
  const now = context.currentTime;
  const notes =
    kind === 'capture'
      ? [330, 440, 660]
      : kind === 'hit'
        ? [110]
        : kind === 'death'
          ? [160, 100]
          : kind === 'pickup'
            ? [520, 780]
            : kind === 'return'
              ? [440, 330]
              : kind === 'shot'
                ? [650]
                : [220];
  notes.forEach((freq, i) => {
    const osc = context!.createOscillator(),
      gain = context!.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, now + i * 0.09);
    gain.gain.setValueAtTime(0.065, now + i * 0.09);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.09 + 0.14);
    osc.connect(gain);
    gain.connect(context!.destination);
    osc.start(now + i * 0.09);
    osc.stop(now + i * 0.09 + 0.15);
  });
}
