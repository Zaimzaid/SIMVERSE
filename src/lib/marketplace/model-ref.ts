/** Only direct, supported GLB references can be bound to a 3D Entity visual. */
export function isMarketModelReference(reference: string | null | undefined): reference is string {
  if (!reference) return false;
  if (/^\/api\/marketplace\/files\/[a-f0-9]{32}$/.test(reference)) return true;
  if (/^\/(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[^?#]+\.glb$/i.test(reference)) return true;
  try {
    const url = new URL(reference);
    return url.protocol === "https:" && url.username === "" && url.password === "" &&
      url.search === "" && url.hash === "" && url.pathname.toLowerCase().endsWith(".glb");
  } catch { return false; }
}
