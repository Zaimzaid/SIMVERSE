import type { Permission } from "@/lib/permissions/roles";

export const CREATE_DESTINATION_IDS = [
  "anything-wars",
  "entity",
  "world",
  "simulation",
  "project",
  "animation",
] as const;

export type CreateDestinationId = (typeof CREATE_DESTINATION_IDS)[number];
export type CreateDestinationStatus = "LIVE" | "COMING_LATER";

export interface CreateDestination {
  id: CreateDestinationId;
  title: string;
  eyebrow: string;
  description: string;
  examples: readonly string[];
  href: string | null;
  requiredPermissions: readonly Permission[];
  status: CreateDestinationStatus;
  note?: string;
}

/**
 * Truthful destination catalog for the beginner Create gateway.
 *
 * This is intentionally separate from presentation components so links and
 * future states can be contract-tested without rendering UI.
 */
export const CREATE_DESTINATIONS: readonly CreateDestination[] = [
  {
    id: "anything-wars",
    title: "Anything Wars",
    eyebrow: "Fastest first creation",
    description: "Choose anything. Make them compete. Watch the story unfold.",
    examples: ["Battle", "Race", "Survival"],
    href: "/anything-wars/quick",
    requiredPermissions: ["simulation.create", "simulation.run"],
    status: "LIVE",
  },
  {
    id: "entity",
    title: "Create a character or object",
    eyebrow: "Reusable creation",
    description: "Create a character, animal, robot, vehicle, country, team, machine, object, or anything else you want to use across SIMVERSE.",
    examples: ["Lion", "Robot", "Car", "Nigeria"],
    href: "/entities/new",
    requiredPermissions: ["entity.create"],
    status: "LIVE",
  },
  {
    id: "world",
    title: "Create a world",
    eyebrow: "Environment blueprint",
    description: "Build the place where your characters, objects, and simulations happen, from arenas and farms to cities, islands, and fantasy worlds.",
    examples: ["Savannah", "City", "Farm", "Arena"],
    href: "/worlds/new",
    requiredPermissions: ["world.manage"],
    status: "LIVE",
    note: "Design its environment, rules, and structure now. Rich 3D world experiences continue to expand over time.",
  },
  {
    id: "simulation",
    title: "Create a simulation",
    eyebrow: "Detailed scenario",
    description: "Choose what should happen, who takes part, and the rules. Then let SIMVERSE calculate the outcome.",
    examples: ["Battle", "Race", "Survival"],
    href: "/simulations/new",
    requiredPermissions: ["simulation.create"],
    status: "LIVE",
  },
  {
    id: "project",
    title: "Create a project",
    eyebrow: "Keep work organized",
    description: "Keep related characters, worlds, and simulations together as your ideas grow.",
    examples: ["Characters", "Worlds", "Events"],
    href: "/projects/new",
    requiredPermissions: ["project.create"],
    status: "LIVE",
  },
  {
    id: "animation",
    title: "Animation Studio",
    eyebrow: "Standalone creator",
    description: "Make independent 2D animated scenes with actors, keyframes and a live preview. 3D and dialogue follow later.",
    examples: ["Scenes", "Keyframes", "Cameras", "Dialogue"],
    href: "/animation",
    requiredPermissions: ["media.create"],
    status: "LIVE",
    note: "2D keyframe editor V1 is live; 3D rigs, voice and rendering are future milestones.",
  },
] as const;

export function createDestinationById(id: CreateDestinationId): CreateDestination {
  const destination = CREATE_DESTINATIONS.find((item) => item.id === id);
  if (!destination) throw new Error(`Unknown Create destination: ${id}`);
  return destination;
}

export function canOpenCreateDestination(
  destination: CreateDestination,
  permissions: readonly string[],
): boolean {
  return destination.status === "LIVE" && destination.href !== null &&
    destination.requiredPermissions.every((permission) => permissions.includes(permission));
}
