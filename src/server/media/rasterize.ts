import type { ExportDimensions } from "@/lib/media/export/constants";

/**
 * Server-only SVG → PNG rasterizer.
 *
 * `@resvg/resvg-js` is a native module kept out of the client bundle (see
 * `serverExternalPackages` in next.config.ts) and dynamically imported here so
 * it is only loaded when an export is actually rendered. The rasterizer is
 * handed an already-rendered, bounded SVG string; it fetches nothing and runs
 * no creator-supplied code.
 */
export async function rasterizeSvgToPng(svg: string, dimensions: ExportDimensions): Promise<Uint8Array<ArrayBuffer>> {
  const { Resvg } = await import("@resvg/resvg-js");
  const resvg = new Resvg(svg, {
    // The SVG viewBox already matches the target aspect ratio, so fitting the
    // width yields the exact approved output dimensions.
    fitTo: { mode: "width", value: dimensions.width },
    font: { loadSystemFonts: true },
    background: "#070a12",
  });
  const rendered = resvg.render();
  const png = rendered.asPng();
  // Copy into a fresh ArrayBuffer-backed view so the bytes are a valid BodyInit
  // (Node's Buffer is Uint8Array<ArrayBufferLike>, which Response rejects).
  const out = new Uint8Array(png.byteLength);
  out.set(png);
  return out;
}
