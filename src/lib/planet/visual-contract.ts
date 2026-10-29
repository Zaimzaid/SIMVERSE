/** Pure sizing contract for the first fictional planet visual proof. */
export const SIGNATURE_PLANET_V1 = Object.freeze({
  name: "SIMVERSE Planet",
  radiusKm: 6000,
  countries: [] as readonly [],
  primaryRingRadius: 2.02,
  secondaryRingRadius: 2.33,
  maxVisualRadius: 2.5,
  verticalFovDegrees: 42,
});

/**
 * Keep the entire orbital ring visible at the home position even on narrow
 * portrait screens. Camera distance is intentionally based on aspect ratio,
 * not on a user agent/browser guess.
 */
export function planetHomeCameraDistance(aspect: number): number {
  if (!Number.isFinite(aspect) || aspect <= 0) return 7.15;
  const fov = SIGNATURE_PLANET_V1.verticalFovDegrees * Math.PI / 180;
  const halfWidthAtUnitDistance = Math.tan(fov / 2) * aspect;
  return Math.max(7.15, SIGNATURE_PLANET_V1.maxVisualRadius / halfWidthAtUnitDistance);
}
