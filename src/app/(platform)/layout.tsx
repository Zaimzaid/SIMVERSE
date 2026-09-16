import { requirePlatformContext } from "@/server/context";
import { PlatformShell } from "@/components/platform/platform-shell";

/**
 * Layout for all authenticated platform pages. Resolves the platform context
 * once (redirecting to /login if unauthenticated) and hands the shell a plain,
 * serializable slice of it. Every child page can additionally call the context
 * for server-side data + authorization.
 */
export default async function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await requirePlatformContext();

  return (
    <PlatformShell
      user={{
        id: ctx.user.id,
        displayName: ctx.user.displayName,
        email: ctx.user.email,
        avatarUrl: ctx.user.avatarUrl,
      }}
      workspace={{
        id: ctx.workspace.id,
        name: ctx.workspace.name,
        slug: ctx.workspace.slug,
      }}
      workspaces={ctx.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
      }))}
      role={ctx.role}
      permissions={ctx.permissions}
    >
      {children}
    </PlatformShell>
  );
}
