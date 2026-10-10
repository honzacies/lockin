/** Krátký dvoutónový signál (Web Audio — žádný zvukový soubor). */
export function PlayChime(): void {
  try {
    const ctx = new AudioContext();
    [880, 1318.5].forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const start = ctx.currentTime + i * 0.18;
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.5);
    });
    setTimeout(() => ctx.close(), 1200);
  } catch {
    // bez zvuku — nevadí
  }
}
