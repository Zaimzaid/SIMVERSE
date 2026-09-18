import type { CueKind } from "./types";

/** Original synthesized cues. The viewer remains fully functional when browser audio is blocked. */
export class ViewerAudio {
  private context: AudioContext | null = null;
  private muted = true;
  private volume = 0.4;

  async unlock() {
    try {
      this.context ??= new AudioContext();
      await this.context.resume();
    } catch { /* Visual replay is independent of audio permission. */ }
  }

  setMuted(value: boolean) { this.muted = value; }
  setVolume(value: number) { this.volume = Math.max(0, Math.min(1, value)); }

  play(kind: CueKind) {
    const audio = this.context;
    if (!audio || audio.state !== "running" || this.muted || this.volume === 0) return;
    const frequencies: Partial<Record<CueKind, number>> = {
      START: 360, ATTACK: 210, DEFEND: 260, DODGE: 430, DAMAGE: 130,
      CRITICAL: 650, ELIMINATE: 90, COMPLETE: 540,
    };
    const frequency = frequencies[kind];
    if (!frequency) return;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = kind === "DAMAGE" || kind === "ELIMINATE" ? "triangle" : "sine";
    oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(45, frequency * 0.55), audio.currentTime + 0.13);
    gain.gain.setValueAtTime(Math.max(0.001, this.volume * 0.07), audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.17);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(); oscillator.stop(audio.currentTime + 0.18);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }

  dispose() { const context = this.context; this.context = null; if (context) void context.close(); }
}
