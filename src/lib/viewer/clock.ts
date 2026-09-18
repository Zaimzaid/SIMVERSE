/** Presentation clock. Wall time never enters Core simulation state. */
export class ViewerClock {
  private positionMs = 0;
  private lastWallMs: number | null = null;
  private playing = false;
  private speed = 1;

  constructor(readonly durationMs: number) {}

  get position() { return this.positionMs; }
  get isPlaying() { return this.playing; }
  get playbackSpeed() { return this.speed; }

  play(nowMs: number) {
    if (this.positionMs >= this.durationMs) this.positionMs = 0;
    this.playing = true;
    this.lastWallMs = nowMs;
  }

  pause() { this.playing = false; this.lastWallMs = null; }
  restart() { this.positionMs = 0; this.lastWallMs = null; this.playing = false; }
  seek(positionMs: number, nowMs?: number) {
    this.positionMs = Math.min(this.durationMs, Math.max(0, positionMs));
    this.lastWallMs = nowMs ?? null;
    if (this.positionMs === this.durationMs) this.pause();
  }
  setSpeed(speed: number) {
    if (![0.5, 1, 1.5, 2].includes(speed)) throw new Error("Unsupported playback speed.");
    this.speed = speed;
  }
  advance(nowMs: number) {
    if (this.playing && this.lastWallMs !== null) {
      this.positionMs = Math.min(this.durationMs, this.positionMs + Math.max(0, nowMs - this.lastWallMs) * this.speed);
      if (this.positionMs === this.durationMs) this.pause();
      else this.lastWallMs = nowMs;
    } else if (this.playing) this.lastWallMs = nowMs;
    return this.positionMs;
  }
}
