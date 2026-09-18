"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Archive,
  ArchiveRestore,
  Copy,
  MoreVertical,
  Pencil,
  Trash2,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";
import type { SimulationStatus } from "@/lib/simulations/constants";
import { apiFetch } from "@/lib/client/api";
import type { SimulationView } from "@/server/services/simulation-service";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import {
  Dropdown,
  DropdownItem,
  DropdownSeparator,
} from "@/components/ui/dropdown";

export interface SimulationActionsProps {
  simulation: { id: string; name: string; status: SimulationStatus };
  permissions: Permission[];
  /** Show a "View" item (used on cards, hidden on the detail page). */
  showView?: boolean;
  /** After duplicating, navigate to the new simulation instead of just refreshing. */
  navigateOnDuplicate?: boolean;
}

/**
 * Permission-gated action menu for a simulation: edit, duplicate, archive/restore,
 * delete. There is deliberately NO "run" action — the execution engine arrives in
 * Phase 3, so a simulation blueprint can be configured but never run here.
 */
export function SimulationActions({
  simulation,
  permissions,
  showView = true,
  navigateOnDuplicate = false,
}: SimulationActionsProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const can = (p: Permission) => permissions.includes(p);
  const isArchived = simulation.status === "ARCHIVED";

  const canEdit = can("simulation.edit");
  const canDuplicate = can("simulation.duplicate");
  const canArchive = can("simulation.archive");
  const canDelete = can("simulation.delete");

  async function post(path: string, action: string, success: string) {
    setBusy(true);
    const { data, error } = await apiFetch<{ simulation?: SimulationView }>(path, { method: "POST" });
    setBusy(false);
    if (error) {
      toast({ variant: "error", title: `Couldn’t ${action}`, description: error.message });
      return null;
    }
    toast({ variant: "success", title: success });
    return data;
  }

  async function onArchive() {
    if (!(await post(`/api/simulations/${simulation.id}/archive`, "archive simulation", "Simulation archived"))) return;
    router.refresh();
  }

  async function onRestore() {
    if (!(await post(`/api/simulations/${simulation.id}/restore`, "restore simulation", "Simulation restored"))) return;
    router.refresh();
  }

  async function onDuplicate() {
    const data = await post(`/api/simulations/${simulation.id}/duplicate`, "duplicate simulation", "Simulation duplicated");
    if (!data) return;
    const created = data.simulation;
    if (navigateOnDuplicate && created) {
      router.push(`/simulations/${created.id}`);
    }
    router.refresh();
  }

  async function onDelete() {
    setBusy(true);
    const { error } = await apiFetch<{ id: string }>(`/api/simulations/${simulation.id}`, { method: "DELETE" });
    setBusy(false);
    setConfirmDelete(false);
    if (error) {
      toast({ variant: "error", title: "Couldn’t delete simulation", description: error.message });
      return;
    }
    toast({
      variant: "success",
      title: "Simulation deleted",
      description: `“${simulation.name}” was permanently deleted.`,
    });
    router.push("/simulations");
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
            aria-label={`Actions for ${simulation.name}`}
            disabled={busy}
          >
            <MoreVertical className="size-4" />
          </Button>
        )}
      >
        {showView ? (
          <DropdownItem onClick={() => router.push(`/simulations/${simulation.id}`)}>
            View
          </DropdownItem>
        ) : null}
        {canEdit && !isArchived ? (
          <DropdownItem onClick={() => router.push(`/simulations/${simulation.id}/edit`)}>
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
        title="Delete this simulation?"
        description={`“${simulation.name}” and its configuration will be permanently deleted. The entities it references stay in your library. This cannot be undone.`}
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
