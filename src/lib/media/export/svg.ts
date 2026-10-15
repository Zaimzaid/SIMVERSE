import {
  MEDIA_EXPORT_DIMENSIONS,
  MAX_EXPORT_SVG_BYTES,
} from "./constants";
import type {
  ResultGraphicHighlight,
  ResultGraphicParticipant,
  ResultGraphicV1,
} from "./model";

/**
 * Deterministic SVG renderer for ResultGraphicV1.
 *
 * Pure and isomorphic: the server rasterizes the output to PNG and the client
 * previews the identical string, so preview and download are the same design.
 *
 * SECURITY: every piece of creator- or Run-derived text passes through
 * escapeXml before it reaches markup, and colors are already validated hex in
 * the model. No creator string is ever placed in an attribute, URL, <style> or
 * raw markup position. Injection payloads therefore render as inert text.
 */

const FONT = "'Segoe UI', 'Inter', 'Helvetica Neue', Arial, sans-serif";

const BG_TOP = "#070a12";
const BG_MID = "#0b1120";
const BG_END = "#140b24";
const BORDER = "#2b3648";
const FG = "#eaf0fb";
const SECONDARY = "#98a4bb";
const MUTED = "#616d83";
const ACCENT = "#22d3ee";
const GOLD = "#fbbf24";

export function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function r2(value: number): number {
  return Math.round(value * 100) / 100;
}

interface TextSpec {
  x: number;
  y: number;
  size: number;
  fill: string;
  weight?: number;
  anchor?: "start" | "middle" | "end";
  letterSpacing?: number;
  opacity?: number;
  uppercase?: boolean;
  family?: string;
}

function text(content: string, spec: TextSpec): string {
  const value = spec.uppercase ? content.toUpperCase() : content;
  const attrs = [
    `x="${r2(spec.x)}"`,
    `y="${r2(spec.y)}"`,
    `font-family="${spec.family ?? FONT}"`,
    `font-size="${r2(spec.size)}"`,
    `font-weight="${spec.weight ?? 400}"`,
    `fill="${spec.fill}"`,
    `text-anchor="${spec.anchor ?? "start"}"`,
    spec.letterSpacing ? `letter-spacing="${r2(spec.letterSpacing)}"` : "",
    spec.opacity != null ? `opacity="${spec.opacity}"` : "",
  ].filter(Boolean).join(" ");
  return `<text ${attrs}>${escapeXml(value)}</text>`;
}

/** Approximate per-line character budget for a width/size (no server font metrics). */
function maxChars(available: number, size: number, glyphRatio: number): number {
  return Math.max(4, Math.floor(available / (size * glyphRatio)));
}

/** Greedy word wrap with a hard line cap and ellipsis when truncated. */
function wrap(raw: string, perLine: number, maxLines: number): string[] {
  const normalized = raw.replace(/\s+/g, " ").trim();
  if (!normalized) return [];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (candidate.length <= perLine || !line) {
      if (!line && word.length > perLine) {
        lines.push(`${word.slice(0, Math.max(1, perLine - 1))}…`);
        if (lines.length >= maxLines) return lines;
        line = "";
        continue;
      }
      line = candidate;
    } else {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  const rendered = lines.join(" ").replace(/…/g, "").trim();
  if (rendered.length < normalized.length && lines.length) {
    const last = lines[lines.length - 1]!;
    if (!last.endsWith("…")) {
      lines[lines.length - 1] = last.length >= perLine
        ? `${last.slice(0, Math.max(1, perLine - 1))}…`
        : `${last}…`;
    }
  }
  return lines;
}

function textBlock(lines: string[], x: number, top: number, size: number, lineHeight: number, spec: Omit<TextSpec, "x" | "y" | "size">): string {
  return lines
    .map((line, index) => text(line, { ...spec, x, y: top + size + index * lineHeight, size }))
    .join("");
}

function starPath(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.42;
  const points: string[] = [];
  for (let i = 0; i < 10; i += 1) {
    const radius = i % 2 === 0 ? outer : inner;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    points.push(`${r2(cx + radius * Math.cos(angle))},${r2(cy + radius * Math.sin(angle))}`);
  }
  return `M${points.join(" L")} Z`;
}

function avatarGroup(participant: ResultGraphicParticipant, cx: number, cy: number, radius: number, showName: boolean): string {
  const parts = [
    `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(radius)}" fill="${BG_MID}" stroke="${participant.color}" stroke-width="${r2(radius * 0.09)}" />`,
    text(participant.initials, { x: cx, y: cy + radius * 0.34, size: radius * 0.82, fill: participant.color, weight: 700, anchor: "middle" }),
  ];
  if (showName) {
    parts.push(text(participant.name, { x: cx, y: cy + radius + radius * 0.58, size: radius * 0.42, fill: SECONDARY, weight: 600, anchor: "middle" }));
  }
  return parts.join("");
}

interface Geometry {
  width: number;
  height: number;
  s: number;
  pad: number;
}

function background(geo: Geometry): string {
  const { width, height } = geo;
  return [
    `<rect width="${width}" height="${height}" fill="url(#bgGrad)" />`,
    `<rect x="0" y="0" width="${width}" height="${height}" fill="url(#glow)" />`,
    `<rect x="${r2(geo.pad * 0.5)}" y="${r2(geo.pad * 0.5)}" width="${r2(width - geo.pad)}" height="${r2(height - geo.pad)}" rx="${r2(28 * geo.s)}" fill="none" stroke="${BORDER}" stroke-width="${r2(1.5 * geo.s)}" opacity="0.6" />`,
  ].join("");
}

function brandRow(geo: Geometry, model: ResultGraphicV1): string {
  const { pad, s, width } = geo;
  const baseline = pad + 34 * s;
  const wordmarkSize = 40 * s;
  const spacing = 6 * s;
  // Estimate the wordmark's rendered width so the mode tag never overlaps it.
  const wordmarkWidth = model.brand.wordmark.length * wordmarkSize * 0.64 + (model.brand.wordmark.length - 1) * spacing;
  const dotX = pad + wordmarkWidth + 30 * s;
  return [
    text(model.brand.wordmark, { x: pad, y: baseline, size: wordmarkSize, fill: FG, weight: 800, letterSpacing: spacing, family: FONT }),
    `<circle cx="${r2(dotX)}" cy="${r2(baseline - 12 * s)}" r="${r2(5 * s)}" fill="${ACCENT}" />`,
    text(model.mode, { x: dotX + 18 * s, y: baseline, size: 28 * s, fill: ACCENT, weight: 600, letterSpacing: 4 * s, uppercase: true }),
    text(model.result.resultType, { x: width - pad, y: baseline, size: 24 * s, fill: MUTED, weight: 600, anchor: "end", letterSpacing: 3 * s, uppercase: true }),
  ].join("");
}

/** A creator subtitle worth showing — present and not just a copy of the headline. */
function meaningfulSubtitle(model: ResultGraphicV1): string | null {
  const subtitle = model.subtitle?.trim();
  if (!subtitle) return null;
  return subtitle.toLowerCase() === model.result.headline.trim().toLowerCase() ? null : subtitle;
}

function footerRow(geo: Geometry, model: ResultGraphicV1): string {
  const { pad, s, width, height } = geo;
  const baseline = height - pad;
  const rank = model.result.ranking.slice(0, 3).map((entry) => `${entry.rank}  ${entry.name}`).join("    ");
  return [
    `<line x1="${pad}" y1="${r2(baseline - 44 * s)}" x2="${r2(width - pad)}" y2="${r2(baseline - 44 * s)}" stroke="${BORDER}" stroke-width="${r2(1.5 * s)}" opacity="0.7" />`,
    text(model.simulationName, { x: pad, y: baseline, size: 28 * s, fill: SECONDARY, weight: 600 }),
    rank ? text(rank, { x: width - pad, y: baseline, size: 26 * s, fill: MUTED, weight: 500, anchor: "end" }) : "",
  ].join("");
}

function leaderParticipants(model: ResultGraphicV1): ResultGraphicParticipant[] {
  const refs = model.result.tiedRefs.length > 1 ? model.result.tiedRefs : model.result.winnerRefs;
  const byRef = new Map(model.participants.map((participant) => [participant.ref, participant]));
  const leaders = refs.map((ref) => byRef.get(ref)).filter((value): value is ResultGraphicParticipant => Boolean(value));
  return leaders.length ? leaders : model.participants.slice(0, 2);
}

function renderCard(geo: Geometry, model: ResultGraphicV1): string {
  const { width, height, s, pad } = geo;
  const centerX = width / 2;
  const available = width - pad * 2;

  const bandBottom = pad + 70 * s;
  const footerTop = height - pad - 70 * s;

  const leaders = leaderParticipants(model);
  const avatarCount = Math.min(4, leaders.length);
  const avatarR = 62 * s;

  const headlineSize = width >= 1500 ? 122 * s : 100 * s;
  const headlineLines = wrap(model.result.headline, maxChars(available, headlineSize, 0.6), 3);
  const headlineLH = headlineSize * 1.04;
  const headlineH = headlineLines.length * headlineLH;

  const detailRaw = meaningfulSubtitle(model) ?? model.result.detail;
  const detailSize = 37 * s;
  const detailLines = wrap(detailRaw, maxChars(available, detailSize, 0.52), 3);
  const detailLH = detailSize * 1.32;
  const detailH = detailLines.length * detailLH;

  const starOuter = 44 * s;
  const avatarH = avatarCount ? avatarR * 2 + 52 * s : 0;

  const gStarLabel = 30 * s;
  const gLabelHead = 26 * s;
  const gHeadAvatars = 48 * s;
  const gAvatarsDetail = 42 * s;

  const blockH = starOuter * 2 + gStarLabel + 34 * s + gLabelHead + headlineH
    + (avatarCount ? gHeadAvatars + avatarH : 0)
    + (detailLines.length ? gAvatarsDetail + detailH : 0);
  const availH = footerTop - bandBottom;
  let y = bandBottom + Math.max(0, (availH - blockH) / 2);

  const parts: string[] = [];
  // Winner star mark
  const starCy = y + starOuter;
  parts.push(`<path d="${starPath(centerX, starCy, starOuter)}" fill="${GOLD}" opacity="0.95" />`);
  y = starCy + starOuter + gStarLabel;

  // "FINAL RESULT" label
  parts.push(text("Final result", { x: centerX, y: y + 24 * s, size: 28 * s, fill: SECONDARY, weight: 700, anchor: "middle", letterSpacing: 6 * s, uppercase: true }));
  y += 34 * s + gLabelHead;

  // Headline
  parts.push(textBlock(headlineLines, centerX, y, headlineSize, headlineLH, { fill: FG, weight: 800, anchor: "middle", uppercase: true }));
  y += headlineH;

  // Leader avatars
  if (avatarCount) {
    y += gHeadAvatars;
    const gap = 42 * s;
    const totalWidth = avatarCount * (avatarR * 2) + (avatarCount - 1) * gap;
    let cx = centerX - totalWidth / 2 + avatarR;
    const cy = y + avatarR;
    for (let i = 0; i < avatarCount; i += 1) {
      parts.push(avatarGroup(leaders[i]!, cx, cy, avatarR, true));
      cx += avatarR * 2 + gap;
    }
    if (leaders.length > avatarCount) {
      parts.push(text(`+${leaders.length - avatarCount}`, { x: centerX, y: cy + avatarR + 44 * s, size: 26 * s, fill: MUTED, weight: 600, anchor: "middle" }));
    }
    y += avatarH;
  }

  // Detail / subtitle
  if (detailLines.length) {
    y += gAvatarsDetail;
    parts.push(textBlock(detailLines, centerX, y, detailSize, detailLH, { fill: SECONDARY, weight: 500, anchor: "middle" }));
  }

  return parts.join("");
}

function renderPoster(geo: Geometry, model: ResultGraphicV1): string {
  const { width, height, s, pad } = geo;
  const available = width - pad * 2;
  const parts: string[] = [];

  let y = pad + 70 * s;

  // Title (creator presentation copy)
  const titleSize = width >= 1500 ? 76 * s : 64 * s;
  const titleLines = wrap(model.title, maxChars(available, titleSize, 0.56), 2);
  const titleLH = titleSize * 1.06;
  parts.push(textBlock(titleLines, pad, y, titleSize, titleLH, { fill: FG, weight: 800 }));
  y += titleLines.length * titleLH + 14 * s;

  const posterSubtitle = meaningfulSubtitle(model);
  if (posterSubtitle) {
    const subSize = 34 * s;
    const subLines = wrap(posterSubtitle, maxChars(available, subSize, 0.52), 2);
    parts.push(textBlock(subLines, pad, y, subSize, subSize * 1.3, { fill: SECONDARY, weight: 500 }));
    y += subLines.length * subSize * 1.3;
  }
  y += 26 * s;

  // Result strip (bottom)
  const stripH = 180 * s;
  const stripTop = height - pad - stripH;

  // Highlights list (between title and strip)
  const highlights: ResultGraphicHighlight[] = model.highlights;
  const listTop = y;
  const listBottom = stripTop - 34 * s;
  if (highlights.length) {
    const rowH = Math.min(150 * s, (listBottom - listTop) / highlights.length);
    const titleHSize = 38 * s;
    const captionSize = 28 * s;
    highlights.forEach((highlight, index) => {
      const rowTop = listTop + index * rowH;
      const marker = pad + 10 * s;
      parts.push(`<rect x="${r2(pad)}" y="${r2(rowTop + 6 * s)}" width="${r2(6 * s)}" height="${r2(rowH - 28 * s)}" rx="${r2(3 * s)}" fill="${ACCENT}" opacity="0.9" />`);
      parts.push(text(highlight.title, { x: marker + 28 * s, y: rowTop + titleHSize + 6 * s, size: titleHSize, fill: FG, weight: 700 }));
      if (highlight.caption) {
        const capLines = wrap(highlight.caption, maxChars(available - 40 * s, captionSize, 0.52), 2);
        parts.push(textBlock(capLines, marker + 28 * s, rowTop + titleHSize + 16 * s, captionSize, captionSize * 1.28, { fill: SECONDARY, weight: 400 }));
      }
    });
  }

  // Result strip background + content
  parts.push(`<rect x="${r2(pad)}" y="${r2(stripTop)}" width="${r2(available)}" height="${r2(stripH)}" rx="${r2(24 * s)}" fill="${BG_MID}" stroke="${BORDER}" stroke-width="${r2(1.5 * s)}" />`);
  const starCx = pad + 70 * s;
  const starCy = stripTop + stripH / 2;
  parts.push(`<path d="${starPath(starCx, starCy, 42 * s)}" fill="${GOLD}" />`);
  const headlineSize = width >= 1500 ? 64 * s : 54 * s;
  const headlineLines = wrap(model.result.headline, maxChars(available - 150 * s, headlineSize, 0.6), 1);
  parts.push(text(headlineLines[0] ?? model.result.headline, { x: starCx + 70 * s, y: starCy - 6 * s, size: headlineSize, fill: FG, weight: 800, uppercase: true }));
  const rank = model.result.ranking.slice(0, 3).map((entry) => `${entry.rank}  ${entry.name}`).join("     ");
  if (rank) {
    parts.push(text(rank, { x: starCx + 70 * s, y: starCy + 46 * s, size: 30 * s, fill: SECONDARY, weight: 500 }));
  }

  return parts.join("");
}

export function renderResultGraphicSvg(model: ResultGraphicV1): string {
  const { width, height } = model.dimensions;
  const geo: Geometry = { width, height, s: Math.min(width, height) / 1080, pad: Math.round((Math.min(width, height) / 1080) * 84) };

  const defs = `<defs>`
    + `<linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="${BG_TOP}" /><stop offset="0.55" stop-color="${BG_MID}" /><stop offset="1" stop-color="${BG_END}" />`
    + `</linearGradient>`
    + `<radialGradient id="glow" cx="0.5" cy="0.05" r="0.8">`
    + `<stop offset="0" stop-color="${ACCENT}" stop-opacity="0.16" /><stop offset="0.6" stop-color="${ACCENT}" stop-opacity="0" />`
    + `</radialGradient>`
    + `</defs>`;

  const content = model.exportType === "STORY_POSTER" ? renderPoster(geo, model) : renderCard(geo, model);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`
    + defs
    + background(geo)
    + brandRow(geo, model)
    + content
    + (model.exportType === "STORY_POSTER" ? "" : footerRow(geo, model))
    + `</svg>`;

  // Isomorphic byte count (TextEncoder exists in Node and the browser; Buffer does not).
  if (new TextEncoder().encode(svg).length > MAX_EXPORT_SVG_BYTES) {
    throw new Error("Rendered export SVG exceeded the maximum allowed size.");
  }
  return svg;
}

export function exportDimensionsFor(model: ResultGraphicV1): { width: number; height: number } {
  return MEDIA_EXPORT_DIMENSIONS[model.aspectRatio];
}
