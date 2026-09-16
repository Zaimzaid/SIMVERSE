import type { Metadata } from "next";
import { Users } from "lucide-react";
import type { WorkspaceRole } from "@/lib/permissions";
import { ROLE_META, WORKSPACE_ROLES } from "@/lib/permissions";
import { formatRelativeTime } from "@/lib/utils";
import { requirePlatformContext } from "@/server/context";
import { getWorkspaceMembers } from "@/server/services/workspace-service";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ComingSoonButton } from "@/components/platform/coming-soon-button";

export const metadata: Metadata = { title: "Team" };

function roleBadgeVariant(role: WorkspaceRole): "accent" | "outline" {
  return role === "OWNER" || role === "ADMIN" ? "accent" : "outline";
}

export default async function TeamPage() {
  const { user, workspace, permissions } = await requirePlatformContext();
  const canManageMembers = permissions.includes("workspace.members.manage");
  const members = await getWorkspaceMembers(user.id, workspace.id);

  return (
    <div className="space-y-8">
      <PageHeader
        icon={Users}
        title="Team"
        description={`People with access to ${workspace.name}.`}
        actions={
          canManageMembers ? (
            <ComingSoonButton
              label="Invite member"
              feature="Inviting teammates arrives in a future phase."
            />
          ) : undefined
        }
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Members
          <span className="ml-2 font-normal normal-case tracking-normal text-secondary">
            {members.length}
          </span>
        </h2>

        {members.length === 0 ? (
          <EmptyState icon={Users} title="No members yet" />
        ) : (
          <Card className="divide-y divide-border p-0">
            {members.map((member) => {
              const isCurrentUser = member.userId === user.id;
              return (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-4 sm:px-5"
                >
                  <Avatar name={member.user.displayName} src={member.user.avatarUrl} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-foreground">
                        {member.user.displayName}
                      </p>
                      {isCurrentUser ? (
                        <Badge variant="neutral">You</Badge>
                      ) : null}
                    </div>
                    <p className="truncate text-sm text-secondary">
                      {member.user.email}
                    </p>
                  </div>
                  <div className="hidden text-right text-xs text-muted sm:block">
                    Joined {formatRelativeTime(member.createdAt)}
                  </div>
                  <Badge variant={roleBadgeVariant(member.role)}>
                    {ROLE_META[member.role].label}
                  </Badge>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Roles
        </h2>
        <Card className="divide-y divide-border p-0">
          {WORKSPACE_ROLES.map((role) => (
            <div key={role} className="flex items-start gap-4 p-4 sm:px-5">
              <Badge variant={roleBadgeVariant(role)} className="mt-0.5 w-20 justify-center">
                {ROLE_META[role].label}
              </Badge>
              <p className="flex-1 text-sm text-secondary">
                {ROLE_META[role].description}
              </p>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
