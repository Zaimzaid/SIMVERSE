import { prisma } from "@/server/db/client";

/**
 * Profile is an aggregation layer, not a second owner of creations.
 * Private entries require a CURRENT workspace membership; public entries
 * require an explicitly PUBLIC share, never merely an unlisted link.
 */
export async function getMyCreatorPortfolio(userId: string) {
  const memberships = await prisma.workspaceMember.findMany({
    where: { userId }, select: { workspaceId: true },
  });
  const workspaceId = { in: memberships.map((m) => m.workspaceId) };
  const [projects, worlds, simulations, animations, published] = await Promise.all([
    prisma.project.findMany({
      where: { createdById: userId, workspaceId }, select: { id: true, name: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "desc" }, take: 20,
    }),
    prisma.world.findMany({
      where: { createdById: userId, workspaceId }, select: { id: true, name: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "desc" }, take: 20,
    }),
    prisma.simulation.findMany({
      where: { createdById: userId, workspaceId }, select: { id: true, name: true, updatedAt: true, status: true },
      orderBy: { updatedAt: "desc" }, take: 20,
    }),
    prisma.animationProject.findMany({
      where: { ownerId: userId, workspaceId }, select: { id: true, title: true, updatedAt: true, sceneJson: true },
      orderBy: { updatedAt: "desc" }, take: 20,
    }),
    prisma.mediaShare.findMany({
      where: { createdById: userId, visibility: "PUBLIC", artifact: { status: { not: "ARCHIVED" } } },
      select: { publicId: true, titleOverride: true, updatedAt: true, artifact: { select: { type: true } } },
      orderBy: { updatedAt: "desc" }, take: 20,
    }),
  ]);
  const items = [
    ...projects.map((p) => ({ id: p.id, title: p.name, type: "Project", status: p.status,
      href: "/projects/" + p.id, updatedAt: p.updatedAt })),
    ...worlds.map((w) => ({ id: w.id, title: w.name, type: "World blueprint", status: w.status,
      href: "/worlds/" + w.id, updatedAt: w.updatedAt })),
    ...simulations.map((s) => ({ id: s.id, title: s.name, type: "Simulation", status: s.status,
      href: "/simulations/" + s.id, updatedAt: s.updatedAt })),
    ...animations.map((a) => ({ id: a.id, title: a.title, type: "Animation", status: "PRIVATE",
      href: a.sceneJson.includes('"mode":"3D"') ? "/animation/3d" : "/animation", updatedAt: a.updatedAt })),
  ].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  return { items, published: published.map((s) => ({
    publicId: s.publicId, title: s.titleOverride || s.artifact.type + " story",
    href: "/s/" + s.publicId, updatedAt: s.updatedAt,
  })) };
}

export async function getPublicCreatorPortfolio(userId: string) {
  return prisma.mediaShare.findMany({
    where: { createdById: userId, visibility: "PUBLIC", artifact: { status: { not: "ARCHIVED" } } },
    select: { publicId: true, titleOverride: true, artifact: { select: { type: true } } },
    orderBy: { updatedAt: "desc" }, take: 12,
  });
}
