/**
 * Small, deterministic movement model for the player-avatar playable proof.
 * World simulation uses meters/second, and does not trust client actions for
 * authoritative multiplayer physics or economic effects.
 */
export type MovementInput = Readonly<{
  forward: boolean; backward: boolean; left: boolean; right: boolean;
}>;
export type GroundPoint = Readonly<{ x: number; z: number }>;
export type Obstacle = Readonly<{ x: number; z: number; halfWidth: number; halfDepth: number }>;

export const PLAYER_SPEED = 3.6;
export const WORLD_LIMIT = 8.25;
export const PLAYER_RADIUS = 0.38;
export const WORLD_OBSTACLES: readonly Obstacle[] = [
  { x: -3.2, z: -2.7, halfWidth: 0.65, halfDepth: 0.65 },
  { x: 3.2, z: -2.7, halfWidth: 0.65, halfDepth: 0.65 },
  { x: -4.7, z: 3.4, halfWidth: 0.65, halfDepth: 0.65 },
  { x: 4.7, z: 3.4, halfWidth: 0.65, halfDepth: 0.65 },
] as const;

export function touchesObstacle(x: number, z: number, obstacles: readonly Obstacle[] = WORLD_OBSTACLES): boolean {
  return obstacles.some((box) =>
    Math.abs(x - box.x) < box.halfWidth + PLAYER_RADIUS &&
    Math.abs(z - box.z) < box.halfDepth + PLAYER_RADIUS
  );
}

export function stepPlayer(
  current: GroundPoint, input: MovementInput, seconds: number,
  obstacles: readonly Obstacle[] = WORLD_OBSTACLES,
): GroundPoint {
  if (!Number.isFinite(seconds) || seconds <= 0) return current;
  const xAxis = Number(input.right) - Number(input.left);
  const zAxis = Number(input.backward) - Number(input.forward);
  const length = Math.hypot(xAxis, zAxis);
  if (!length) return current;
  const displacement = PLAYER_SPEED * Math.min(seconds, 0.05) / length;
  const clamp = (value: number) => Math.max(-WORLD_LIMIT, Math.min(WORLD_LIMIT, value));
  let x = clamp(current.x + xAxis * displacement);
  let z = clamp(current.z + zAxis * displacement);
  // Axis resolution permits sliding around trees rather than trapping movement.
  if (touchesObstacle(x, current.z, obstacles)) x = current.x;
  if (touchesObstacle(x, z, obstacles)) z = current.z;
  return { x, z };
}

export function isNear(target: GroundPoint, player: GroundPoint, radius = 1): boolean {
  return Math.hypot(target.x - player.x, target.z - player.z) <= radius;
}
