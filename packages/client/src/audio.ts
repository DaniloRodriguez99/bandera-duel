let context: AudioContext | undefined;
type MusicMode = 'menu' | 'duel' | 'urgent' | 'victory' | 'defeat';
let musicMode: MusicMode = 'menu';
const savedVolume = Number(localStorage.getItem('bandera-music-volume') ?? .35);
export let musicVolume = Number.isFinite(savedVolume) ? Math.max(0, Math.min(1, savedVolume)) : .35;
let musicGain: GainNode | undefined;
let timer: ReturnType<typeof setInterval> | undefined;
let nextNote = 0, beat = 0;
const voices = new Set<OscillatorNode>();
// Original melodies in D minor; no recordings or melodies from other games.
const melodies: Record<MusicMode, number[]> = {
  menu: [74,0,69,72,77,0,76,72,74,0,65,69,72,0,69,0,70,0,74,77,76,0,72,69,67,70,69,65,62,0,0,0],
  duel: [62,69,74,72,65,72,77,74,70,74,77,81,69,76,79,76,62,74,69,77,65,72,69,74,70,77,74,72,69,73,76,69],
  urgent: [74,69,77,74,81,77,74,72,77,72,81,77,84,81,77,74,82,77,79,82,86,82,79,77,81,76,79,73,76,73,69,73],
  victory: [74,0,77,0,81,0,86,0,81,84,86,0,0,0,0,0],
  defeat: [74,0,72,0,69,0,65,0,62,0,0,0,0,0,0,0],
};
function silenceMusic() {
  for (const voice of voices) { voice.stop(); voice.disconnect(); }
  voices.clear();
  nextNote = context?.currentTime ?? 0;
}
function musicNote(note: number, start: number, duration: number, volume: number, type: OscillatorType) {
  if (!context || !musicGain || !note) return;
  const osc = context.createOscillator(), envelope = context.createGain();
  osc.type = type;
  osc.frequency.value = 440 * 2 ** ((note - 69) / 12);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(volume, start + .015);
  envelope.gain.exponentialRampToValueAtTime(.0001, start + duration);
  osc.connect(envelope); envelope.connect(musicGain);
  voices.add(osc);
  osc.onended = () => { voices.delete(osc); osc.disconnect(); envelope.disconnect(); };
  osc.start(start); osc.stop(start + duration + .02);
}
function scheduleMusic() {
  if (!context || context.state !== 'running' || muted || document.hidden || musicVolume === 0) return;
  const melody = melodies[musicMode], ending = musicMode === 'victory' || musicMode === 'defeat';
  const seconds = 60 / (musicMode === 'menu' ? 88 : musicMode === 'urgent' ? 160 : 124) / 2;
  nextNote = Math.max(nextNote, context.currentTime);
  while (nextNote < context.currentTime + .12) {
    if (ending && beat >= melody.length) return;
    musicNote(melody[beat % melody.length], nextNote, seconds * 1.5, .075, musicMode === 'menu' ? 'sine' : 'triangle');
    if (beat % 4 === 0) {
      const root = [50,53,46,45][Math.floor(beat / 8) % 4];
      musicNote(root, nextNote, seconds * 3, .065, 'triangle');
      if (musicMode === 'menu') musicNote(root + 19, nextNote + seconds, seconds * 2, .025, 'sine');
    }
    if (!ending && musicMode !== 'menu' && beat % 2 === 0) musicNote(38, nextNote, .07, .045, 'sine');
    beat++; nextNote += seconds;
  }
}
export function setMusicMode(mode: MusicMode) {
  if (musicMode === mode) return;
  silenceMusic(); musicMode = mode; beat = 0; scheduleMusic();
}
export function setMusicVolume(value: number) {
  if (!Number.isFinite(value)) return;
  musicVolume = Math.max(0, Math.min(1, value));
  localStorage.setItem('bandera-music-volume', String(musicVolume));
  if (musicGain && context) musicGain.gain.setTargetAtTime(muted ? 0 : musicVolume, context.currentTime, .03);
  if (musicVolume === 0) silenceMusic();
  else unlockAudio();
}
function visibilityChanged() { if (document.hidden) silenceMusic(); else scheduleMusic(); }
document.addEventListener('visibilitychange', visibilityChanged);
if (import.meta.hot) import.meta.hot.dispose(() => { clearInterval(timer); silenceMusic(); document.removeEventListener('visibilitychange', visibilityChanged); void context?.close(); });
export let muted = localStorage.getItem('bandera-muted') === 'true';
export function unlockAudio() {
  if (!muted) {
    context ??= new AudioContext();
    if (!musicGain) { musicGain = context.createGain(); musicGain.gain.value = musicVolume; musicGain.connect(context.destination); }
    timer ??= setInterval(scheduleMusic, 50);
    void context.resume().then(scheduleMusic).catch(() => {});
  }
}
export function toggleMute() {
  muted = !muted;
  localStorage.setItem('bandera-muted', String(muted));
  if (musicGain && context) musicGain.gain.setTargetAtTime(muted ? 0 : musicVolume, context.currentTime, .03);
  if (muted) silenceMusic();
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
