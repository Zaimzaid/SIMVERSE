import type { ViewerFrame, VisualEntityInstance } from "./types";

export interface ViewerRenderer {
  draw(frame: ViewerFrame, scene: VisualEntityInstance[], images: ReadonlyMap<string, HTMLImageElement>): void;
  dispose(): void;
}

function color(value: string, fallback: string): string {
  return /^#[\da-f]{3,8}$/i.test(value) ? value : fallback;
}

function ease(value: number): number {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
}

function phase(at: number, start: number, length: number): number { return ease((at - start) / length); }

export class Canvas2DViewerRenderer implements ViewerRenderer {
  constructor(private readonly canvas: HTMLCanvasElement) {}

  draw(frame: ViewerFrame, scene: VisualEntityInstance[], images: ReadonlyMap<string, HTMLImageElement>) {
    const width = Math.max(1, this.canvas.clientWidth);
    const height = Math.max(1, this.canvas.clientHeight);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const pixelWidth = Math.round(width * dpr);
    const pixelHeight = Math.round(height * dpr);
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    const ctx = this.canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, "#09172a"); bg.addColorStop(0.56, "#111d35"); bg.addColorStop(1, "#080d1c");
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    const halo = ctx.createRadialGradient(width * 0.5, height * 0.47, 0, width * 0.5, height * 0.47, width * 0.7);
    halo.addColorStop(0, "rgba(34,211,238,.12)"); halo.addColorStop(1, "rgba(34,211,238,0)");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, width, height);

    ctx.save();
    const { x, y, zoom, shake } = frame.camera;
    ctx.translate(width / 2 + shake * width, height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-x * width, -y * height);
    this.drawArena(ctx, width, height);
    // Back-to-front order makes FFA overlap predictable.
    for (const entity of [...scene].sort((a, b) => a.y - b.y)) {
      this.drawEntity(ctx, entity, frame, scene, images, width, height);
    }
    ctx.restore();

    if (frame.timeMs < 1900) this.drawIntro(ctx, scene, width, height, frame.timeMs);
    if (frame.completed) this.drawOutcome(ctx, frame, scene, width, height);
  }

  private drawArena(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const groundY = height * 0.72;
    ctx.fillStyle = "rgba(14,27,47,.86)";
    ctx.beginPath(); ctx.ellipse(width / 2, groundY, width * 0.58, height * 0.32, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(64,201,228,.28)"; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(width / 2, groundY, width * 0.55, height * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = "rgba(122,174,205,.12)"; ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i += 1) {
      ctx.beginPath(); ctx.ellipse(width / 2, groundY, width * (0.11 * i), height * (0.054 * i), 0, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(width * 0.5, groundY - height * 0.29); ctx.lineTo(width * 0.5, groundY + height * 0.29); ctx.stroke();
    ctx.fillStyle = "rgba(181,225,241,.48)";
    ctx.font = `600 ${Math.max(10, width * 0.012)}px system-ui`;
    ctx.textAlign = "center";
    ctx.fillText("S I M V E R S E   A R E N A", width / 2, height * 0.92);
  }

  private drawEntity(ctx: CanvasRenderingContext2D, entity: VisualEntityInstance, frame: ViewerFrame,
    scene: VisualEntityInstance[], images: ReadonlyMap<string, HTMLImageElement>, width: number, height: number) {
    const status = frame.participants[entity.id] ?? { health: 100, defending: false, eliminated: false };
    const moment = frame.activeMoment;
    const attack = moment?.cues.find((cue) => cue.kind === "ATTACK" && cue.actorId === entity.id);
    const targeted = moment?.cues.find((cue) => cue.kind === "ATTACK" && cue.targetId === entity.id);
    const target = scene.find((other) => other.id === attack?.targetId);
    const dodge = moment?.cues.find((cue) => cue.kind === "DODGE" && cue.targetId === entity.id);
    const hit = moment?.cues.find((cue) => cue.kind === "DAMAGE" && cue.targetId === entity.id);
    const critical = moment?.cues.find((cue) => cue.kind === "CRITICAL" && cue.targetId === entity.id);
    const eliminated = moment?.cues.find((cue) => cue.kind === "ELIMINATE" && cue.targetId === entity.id);
    const at = frame.timeMs;
    const size = Math.max(34, Math.min(scene.length > 2 ? 66 : 82, width * (scene.length > 2 ? 0.095 : 0.13)));
    let px = entity.x * width;
    let py = entity.y * height;
    if (attack && target) {
      const go = phase(at, attack.startMs, 310);
      const back = phase(at, attack.startMs + 560, 310);
      const travel = Math.max(0, go - back) * (frame.reducedMotion ? 0.05 : 0.52);
      px += (target.x - entity.x) * width * travel;
      py += (target.y - entity.y) * height * travel - Math.sin(Math.PI * travel) * 18;
    }
    if (dodge) {
      const out = phase(at, dodge.startMs - 120, 180);
      const back = phase(at, dodge.startMs + 220, 230);
      py -= (out - back) * Math.min(frame.reducedMotion ? 4 : 44, height * 0.12);
      px += entity.facing * (out - back) * (frame.reducedMotion ? 2 : 24);
    }
    if (hit) {
      const impact = phase(at, hit.startMs, 90) - phase(at, hit.startMs + 180, 250);
      px -= entity.facing * impact * (frame.reducedMotion ? 2 : critical ? 28 : 16);
    }
    const fall = eliminated ? phase(at, eliminated.startMs, 500) : status.eliminated ? 1 : 0;
    const primary = color(entity.primaryColor, "#22d3ee");
    const secondary = color(entity.secondaryColor, "#3b82f6");
    ctx.save();
    ctx.globalAlpha = 1 - fall * 0.58;
    ctx.translate(px, py);
    ctx.rotate(frame.reducedMotion ? 0 : fall * entity.facing * 0.95);
    ctx.fillStyle = "rgba(0,0,0,.48)";
    ctx.beginPath(); ctx.ellipse(0, size * 0.57, size * 0.62, size * 0.13, 0, 0, Math.PI * 2); ctx.fill();
    const active = Boolean(attack || targeted || status.defending || (frame.completed && frame.winnerId === entity.id));
    if (active) {
      ctx.shadowColor = primary; ctx.shadowBlur = status.defending ? 28 : 22;
      ctx.strokeStyle = status.defending ? "rgba(147,197,253,.92)" : primary;
      ctx.lineWidth = status.defending ? 4 : 2;
      ctx.beginPath(); ctx.arc(0, 0, size * 0.58, 0, Math.PI * 2); ctx.stroke();
      ctx.shadowBlur = 0;
    }
    const image = images.get(entity.id);
    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, size * 0.49, 0, Math.PI * 2); ctx.clip();
    const fill = ctx.createLinearGradient(-size / 2, -size / 2, size / 2, size / 2);
    fill.addColorStop(0, primary); fill.addColorStop(1, secondary);
    ctx.fillStyle = fill; ctx.fillRect(-size / 2, -size / 2, size, size);
    if (image) {
      const crop = Math.min(image.naturalWidth, image.naturalHeight);
      ctx.drawImage(image, (image.naturalWidth - crop) / 2, (image.naturalHeight - crop) / 2,
        crop, crop, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = "#f8fcff"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.font = `800 ${Math.max(15, size * 0.34)}px system-ui`;
      ctx.fillText(entity.source.kind === "FALLBACK" ? entity.source.initials : entity.shortName.slice(0, 3).toUpperCase(), 0, 1);
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(226,245,255,.84)"; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.49, 0, Math.PI * 2); ctx.stroke();
    if (hit && at >= hit.startMs && at < hit.startMs + 250) {
      const strength = 1 - (at - hit.startMs) / 250;
      ctx.strokeStyle = critical ? `rgba(251,191,36,${strength})` : `rgba(248,113,113,${strength})`;
      ctx.lineWidth = critical ? 7 : 4;
      ctx.beginPath(); ctx.arc(0, 0, size * (0.57 + (1 - strength) * 0.37), 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = critical ? "#fbbf24" : "#fda4af";
      ctx.font = `800 ${Math.max(13, size * 0.24)}px system-ui`; ctx.textAlign = "center";
      ctx.fillText(`${critical ? "CRITICAL " : ""}-${hit.event.payload.amount}`, 0, -size * 0.78 - (1 - strength) * 25);
    }
    if (dodge && at >= dodge.startMs && at < dodge.startMs + 260) {
      ctx.fillStyle = "#b5f4ff"; ctx.font = `800 ${Math.max(12, size * 0.2)}px system-ui`; ctx.textAlign = "center";
      ctx.fillText("DODGE", 0, -size * 0.78);
    }
    if (status.defending) {
      ctx.fillStyle = "#bfdbfe"; ctx.font = `700 ${Math.max(10, size * 0.16)}px system-ui`; ctx.textAlign = "center";
      ctx.fillText("GUARD", 0, -size * 0.68);
    }
    ctx.restore();
    ctx.textAlign = "center"; ctx.font = `700 ${Math.max(11, Math.min(17, width * 0.022))}px system-ui`;
    ctx.fillStyle = "#eef6ff"; ctx.fillText(entity.name.slice(0, 24), px, py + size * 0.72);
  }

  private drawIntro(ctx: CanvasRenderingContext2D, scene: VisualEntityInstance[], width: number, height: number, at: number) {
    const alpha = Math.min(1, at / 250, (1900 - at) / 340);
    ctx.fillStyle = `rgba(4,10,23,${Math.max(0, alpha) * 0.84})`; ctx.fillRect(0, 0, width, height);
    ctx.textAlign = "center";
    ctx.fillStyle = "#83e7f5"; ctx.font = `700 ${Math.max(12, width * 0.018)}px system-ui`;
    ctx.fillText("SIMVERSE  /  BATTLE", width / 2, height * 0.34);
    ctx.fillStyle = "#f4fbff";
    if (scene.length === 2) {
      ctx.font = `800 ${Math.max(21, Math.min(46, width * 0.06))}px system-ui`;
      ctx.fillText(`${scene[0]!.name}   VS   ${scene[1]!.name}`, width / 2, height * 0.52, width * 0.9);
      ctx.fillStyle = "#9eb3ca"; ctx.font = `500 ${Math.max(12, width * 0.015)}px system-ui`;
      ctx.fillText("DUEL", width / 2, height * 0.62);
    } else {
      ctx.font = `800 ${Math.max(22, Math.min(43, width * 0.052))}px system-ui`;
      ctx.fillText("FREE FOR ALL", width / 2, height * 0.47);
      const midpoint = Math.ceil(scene.length / 2);
      ctx.fillStyle = "#c6d8e8";
      ctx.font = `600 ${Math.max(12, Math.min(18, width * 0.026))}px system-ui`;
      ctx.fillText(scene.slice(0, midpoint).map((entity) => entity.name).join("  ·  "), width / 2, height * 0.58, width * 0.9);
      ctx.fillText(scene.slice(midpoint).map((entity) => entity.name).join("  ·  "), width / 2, height * 0.66, width * 0.9);
    }
  }

  private drawOutcome(ctx: CanvasRenderingContext2D, frame: ViewerFrame, scene: VisualEntityInstance[], width: number, height: number) {
    ctx.fillStyle = "rgba(3,10,21,.68)"; ctx.fillRect(0, 0, width, height);
    const winner = scene.find((entity) => entity.id === frame.winnerId);
    const title = frame.timeout ? frame.tiedIds.length > 1 ? "TIME LIMIT · DRAW" : "TIME LIMIT" : "WINNER";
    ctx.textAlign = "center"; ctx.fillStyle = "#81e8f5";
    ctx.font = `800 ${Math.max(18, Math.min(36, width * 0.045))}px system-ui`;
    ctx.fillText(title, width / 2, height * 0.43);
    ctx.fillStyle = "#f8fcff"; ctx.font = `800 ${Math.max(22, Math.min(55, width * 0.065))}px system-ui`;
    ctx.fillText(frame.tiedIds.length > 1 ? frame.tiedIds.map((id) => scene.find((entity) => entity.id === id)?.name).join(" · ") : winner?.name ?? "Battle complete", width / 2, height * 0.56, width * 0.9);
  }

  dispose() { this.canvas.width = 0; this.canvas.height = 0; }
}
