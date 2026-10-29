export type VideoAspect = "16:9" | "9:16" | "1:1";
export type VideoFit = "contain" | "cover";
export type TextPosition = "top" | "center" | "bottom";

export interface VideoEditSettings {
  aspect: VideoAspect;
  fit: VideoFit;
  trimStart: number;
  trimEnd: number;
  speed: number;
  volume: number;
  muted: boolean;
  brightness: number;
  contrast: number;
  saturation: number;
  text: string;
  textColor: string;
  textSize: number;
  textPosition: TextPosition;
  textStart: number;
  textEnd: number;
}

export const OUTPUT_SIZES: Record<VideoAspect, { width: number; height: number; label: string }> = {
  "16:9": { width: 1280, height: 720, label: "Landscape · YouTube" },
  "9:16": { width: 720, height: 1280, label: "Vertical · Reels / Shorts" },
  "1:1": { width: 1080, height: 1080, label: "Square · Social post" },
};

export function initialVideoSettings(duration = 0): VideoEditSettings {
  return {
    aspect: "16:9",
    fit: "contain",
    trimStart: 0,
    trimEnd: duration,
    speed: 1,
    volume: 1,
    muted: false,
    brightness: 100,
    contrast: 100,
    saturation: 100,
    text: "",
    textColor: "#ffffff",
    textSize: 48,
    textPosition: "bottom",
    textStart: 0,
    textEnd: duration,
  };
}

export function clampTrim(start: number, end: number, duration: number): { start: number; end: number } {
  if (!Number.isFinite(duration) || duration <= 0) return { start: 0, end: 0 };
  const safeStart = Math.max(0, Math.min(Number.isFinite(start) ? start : 0, duration - 0.1));
  const safeEnd = Math.max(safeStart + 0.1, Math.min(Number.isFinite(end) ? end : duration, duration));
  return { start: Math.round(safeStart * 100) / 100, end: Math.round(safeEnd * 100) / 100 };
}

export function editedDuration(settings: VideoEditSettings): number {
  return Math.max(0, (settings.trimEnd - settings.trimStart) / Math.max(settings.speed, 0.01));
}

export function formatVideoTime(seconds: number): string {
  const safe = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const whole = Math.floor(safe);
  return String(Math.floor(whole / 60)).padStart(2, "0") + ":" + String(whole % 60).padStart(2, "0");
}

export function videoPlacement(
  sourceWidth: number, sourceHeight: number, targetWidth: number, targetHeight: number, fit: VideoFit,
) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || targetWidth <= 0 || targetHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const ratio = fit === "cover"
    ? Math.max(targetWidth / sourceWidth, targetHeight / sourceHeight)
    : Math.min(targetWidth / sourceWidth, targetHeight / sourceHeight);
  const width = sourceWidth * ratio;
  const height = sourceHeight * ratio;
  return { x: (targetWidth - width) / 2, y: (targetHeight - height) / 2, width, height };
}

function wrapText(ctx: CanvasRenderingContext2D, content: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of content.split(/\n/).slice(0, 4)) {
    let current = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = current ? current + " " + word : word;
      if (current && ctx.measureText(candidate).width > maxWidth) {
        lines.push(current);
        current = word;
      } else {
        current = candidate;
      }
      if (lines.length >= 5) break;
    }
    if (current) lines.push(current);
    if (lines.length >= 5) break;
  }
  return lines.slice(0, 5);
}

/** Shared canvas renderer: preview and recorded output use the same drawing function. */
export function renderVideoFrame(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  settings: VideoEditSettings,
  logo: HTMLImageElement | null,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#060a15";
  ctx.fillRect(0, 0, width, height);

  if (video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0) {
    const rect = videoPlacement(video.videoWidth, video.videoHeight, width, height, settings.fit);
    ctx.save();
    ctx.filter = "brightness(" + settings.brightness + "%) contrast(" + settings.contrast
      + "%) saturate(" + settings.saturation + "%)";
    ctx.drawImage(video, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
  }

  if (logo && logo.complete && logo.naturalWidth > 0) {
    const scale = Math.min(width * 0.18 / logo.naturalWidth, height * 0.15 / logo.naturalHeight);
    const logoWidth = logo.naturalWidth * scale;
    const logoHeight = logo.naturalHeight * scale;
    const margin = Math.round(Math.min(width, height) * 0.05);
    ctx.save();
    ctx.globalAlpha = 0.95;
    ctx.drawImage(logo, width - logoWidth - margin, margin, logoWidth, logoHeight);
    ctx.restore();
  }

  if (settings.text.trim() && video.currentTime >= settings.textStart
      && video.currentTime <= settings.textEnd) {
    const fontSize = Math.max(20, Math.round(settings.textSize * Math.min(width, height) / 720));
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "800 " + fontSize + "px Arial, sans-serif";
    ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(4, fontSize * 0.17);
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.fillStyle = settings.textColor;
    const lines = wrapText(ctx, settings.text.trim(), width * 0.85);
    const lineHeight = fontSize * 1.25;
    const blockHeight = (lines.length - 1) * lineHeight;
    const margin = Math.min(height * 0.12, 110);
    const centerY = settings.textPosition === "top" ? margin + blockHeight / 2
      : settings.textPosition === "bottom" ? height - margin - blockHeight / 2
      : height / 2;
    lines.forEach((line, index) => {
      const y = centerY - blockHeight / 2 + index * lineHeight;
      ctx.strokeText(line, width / 2, y, width * 0.86);
      ctx.fillText(line, width / 2, y, width * 0.86);
    });
    ctx.restore();
  }
}
