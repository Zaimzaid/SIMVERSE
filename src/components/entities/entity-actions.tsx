"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  Archive,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { EntityStatus } from "@/lib/entities/constants";
import { apiFetch } from "@/lib/client/api";
import type { EntityView } from "@/server/services/entity-service";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";

export interface EntityActionsProps {
  entity: { id: string; name: string; status: EntityStatus };
  permissions: Permission[];
  /** Show a "View" item (used on cards, hidden on the detail page). */
  showView?: boolean;
  /** After duplicating, navigate to the new copy (detail page) instead of refreshing in place. */
  navigateOnDuplicate?: boolean;
}

/** Permission-gated action menu for an entity: edit, duplicate, archive/restore, delete. */
export function EntityActions({
  entity,
  permissions,
  showView = true,
  navigateOnDuplicate = true,
}: EntityActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const can = (p: Permission) => permissions.includes(p);
  const isArchived = entity.status === "ARCHIVED";

  const canEdit = can("entity.edit");
  const canDuplicate = can("entity.duplicate");
  const canArchive = can("entity.archive");
  const canDelete = can("entity.delete");

  async function post(path: string, action: string, success: string) {
    setBusy(true);
    const { data, error } = await apiFetch<{ entity?: EntityView }>(path, { method: "POST" });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: `Couldn’t ${action}`, description: error.message });
      return null;
    }
    toast({ variant: "success", title: success });
    return data;
  }

  async function onDuplicate() {
    const data = await post(`/api/entities/${entity.id}/duplicate`, "duplicate entity", "Entity duplicated");
    if (!data) return;
    if (navigateOnDuplicate && data.entity) router.push(`/entities/${data.entity.id}`);
    router.refresh();
  }

  async function onArchive() {
    if (!(await post(`/api/entities/${entity.id}/archive`, "archive entity", "Entity archived"))) return;
    router.refresh();
  }

  async function onRestore() {
    if (!(await post(`/api/entities/${entity.id}/restore`, "restore entity", "Entity restored"))) return;
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    const { error } = await apiFetch<{ id: string }>(`/api/entities/${entity.id}`, { method: "DELETE" });
    setBusy(false);
    setConfirmDelete(false);
    if (error) {
      toast({ variant: "error", title: "Couldn’t delete entity", description: error.message });
      return;
    }
    toast({ variant: "success", title: "Entity deleted", description: `“${entity.name}” was permanently deleted.` });
    router.push("/entities");
    router.refresh();
  }

  // Nothing actionable for this role → render nothing.
  if (!showView && !canEdit && !canDuplicate && !canArchive && !canDelete) return null;

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
            aria-label={`Actions for ${entity.name}`}
            disabled={busy}
          >
            <MoreVertical className="size-4" />
          </Button>
        )}
      >
        {showView ? (
          <DropdownItem onClick={() => router.push(`/entities/${entity.id}`)}>
            View
          </DropdownItem>
        ) : null}
        {canEdit ? (
          <DropdownItem onClick={() => router.push(`/entities/${entity.id}/edit`)}>
            <Pencil className="size-4" />
            Edit
          </DropdownItem>
        ) : null}
        {canDuplicate ? (
          <DropdownItem onClick={onDuplicate}>
            <Copy className="size-4" />
            Duplicate
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
        title="Delete this entity?"
        description={`“${entity.name}” and its attribute values and tags will be permanently removed. This cannot be undone.`}
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
