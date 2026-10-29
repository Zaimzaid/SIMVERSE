/**
 * Seamless procedural colour field on a fictional planet.
 * The longitude coordinate wraps, and every term is evaluated in 3D directions
 * rather than raw pixel x. This prevents the hard longitudinal seam seen in V1.
 */
export function samplePlanetSurface(u: number, v: number): readonly [number, number, number] {
  const angle = u * Math.PI * 2;
  const latitude = (v - 0.5) * Math.PI;
  const nx = Math.cos(latitude) * Math.cos(angle);
  const ny = Math.sin(latitude);
  const nz = Math.cos(latitude) * Math.sin(angle);

  // Smooth, bounded signals, not recognizable continents or country outlines.
  const ribbon = Math.sin(8.2 * ny + 2.2 * Math.sin(3.5 * nx + 2.0 * nz)
    + 0.7 * Math.cos(8 * nz - 3 * nx));
  const shimmer = Math.sin(17.8 * nx + 9.2 * ny + 11 * nz)
    * Math.sin(13.5 * nz - 5.6 * nx + 3.4 * ny);
  const grain = Math.sin(57 * nx + 27 * ny + 18 * nz)
    * Math.sin(53 * nz - 20 * ny - 8 * nx);
  const polar = Math.pow(Math.abs(ny), 3);
  const variation = ribbon * 5.5 + shimmer * 2.6 + grain * 0.85;
  const lift = 1.5 + polar * 8;
  return [
    Math.round(Math.max(0, Math.min(255, 15 + variation * 0.7 + lift))),
    Math.round(Math.max(0, Math.min(255, 51 + variation * 1.2 + lift))),
    Math.round(Math.max(0, Math.min(255, 85 + variation * 1.7 + lift * 1.3))),
  ];
}
