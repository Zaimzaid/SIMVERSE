"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { ProjectStatus } from "@/lib/projects/constants";
import { apiFetch } from "@/lib/client/api";
import type { ProjectView } from "@/server/services/project-service";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";

export interface ProjectActionsProps {
  project: { id: string; name: string; status: ProjectStatus };
  permissions: Permission[];
  /** Show a "View" item (used on cards, hidden on the detail page). */
  showView?: boolean;
}

/** Permission-gated action menu for a project: edit, archive/restore, delete. */
export function ProjectActions({
  project,
  permissions,
  showView = true,
}: ProjectActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const can = (p: Permission) => permissions.includes(p);
  const isArchived = project.status === "ARCHIVED";

  const canEdit = can("project.edit");
  const canArchive = can("project.archive");
  const canDelete = can("project.delete");

  async function post(path: string, action: string, success: string) {
    setBusy(true);
    const { data, error } = await apiFetch<{ project?: ProjectView }>(path, { method: "POST" });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: `Couldn’t ${action}`, description: error.message });
      return null;
    }
    toast({ variant: "success", title: success });
    return data;
  }

  async function onArchive() {
    if (!(await post(`/api/projects/${project.id}/archive`, "archive project", "Project archived"))) return;
    router.refresh();
  }

  async function onRestore() {
    if (!(await post(`/api/projects/${project.id}/restore`, "restore project", "Project restored"))) return;
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    const { error } = await apiFetch<{ id: string }>(`/api/projects/${project.id}`, { method: "DELETE" });
    setBusy(false);
    setConfirmDelete(false);
    if (error) {
      toast({ variant: "error", title: "Couldn’t delete project", description: error.message });
      return;
    }
    toast({
      variant: "success",
      title: "Project deleted",
      description: `“${project.name}” was permanently deleted.`,
    });
    router.push("/projects");
    router.refresh();
  }

  // Nothing actionable for this role → render nothing.
  if (!showView && !canEdit && !canArchive && !canDelete) return null;

  return (
    <>
      <Dropdown
        align="end"
        trigger={({ toggle }) => (
          <Button
            variant="icon"
            size="sm"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggle();
            }}
            aria-label={`Actions for ${project.name}`}
            disabled={busy}
          >
            <MoreVertical className="size-4" />
          </Button>
        )}
      >
        {showView ? (
          <DropdownItem onClick={() => router.push(`/projects/${project.id}`)}>
            View
          </DropdownItem>
        ) : null}
        {canEdit ? (
          <DropdownItem onClick={() => router.push(`/projects/${project.id}/edit`)}>
            <Pencil className="size-4" />
            Edit
          </DropdownItem>
        ) : null}
        {canArchive ? (
          isArchived ? (
            <DropdownItem onClick={onRestore}>
              <ArchiveRestore className="size-4" />
              Restore
            </DropdownItem>
          ) : (
            <DropdownItem onClick={onArchive}>
              <Archive className="size-4" />
              Archive
            </DropdownItem>
          )
        ) : null}
        {canDelete ? (
          <>
            <DropdownSeparator />
            <DropdownItem destructive onClick={() => setConfirmDelete(true)}>
              <Trash2 className="size-4" />
              Delete…
            </DropdownItem>
          </>
        ) : null}
      </Dropdown>

      <Modal
        open={confirmDelete}
        onClose={() => (busy ? undefined : setConfirmDelete(false))}
        title="Delete this project?"
        description={`“${project.name}” and any simulations inside it will be permanently deleted. The entities it references stay in your library. This cannot be undone.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onDelete} loading={busy}>
              Delete permanently
            </Button>
          </>
        }
      />
    </>
  );
}
