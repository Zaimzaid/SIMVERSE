"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { updateWorkspaceSchema } from "@/lib/validation";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface WorkspaceSettingsFormProps {
  workspaceId: string;
  initialName: string;
  canEdit: boolean;
}

/**
 * Rename the active workspace. The server (PATCH /api/workspaces/[id]) is
 * authoritative and enforces membership + workspace.edit; on success we
 * router.refresh() so server components (top bar, page titles) pick up the new
 * name and it persists across reloads.
 */
export function WorkspaceSettingsForm({
  workspaceId,
  initialName,
  canEdit,
}: WorkspaceSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const dirty = name.trim() !== savedName.trim();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const parsed = updateWorkspaceSchema.safeParse({ name });
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { data, error } = await apiFetch<{ workspace: { name: string } }>(
      `/api/workspaces/${workspaceId}`,
      { method: "PATCH", body: JSON.stringify({ name: name.trim() }) },
    );
    setSubmitting(false);

    if (error) {
      if (error.details?.length) setErrors(fieldErrorsFrom(error));
      else toast({ variant: "error", title: "Couldn’t save changes", description: error.message });
      return;
    }

    const nextName = data?.workspace.name ?? name.trim();
    setName(nextName);
    setSavedName(nextName);
    toast({
      variant: "success",
      title: "Workspace updated",
      description: "Your workspace name has been saved.",
    });
    router.refresh();
  }

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>Workspace</CardTitle>
        <CardDescription>
          Your workspace name is visible to everyone with access.
        </CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent>
          <Field
            label="Workspace name"
            htmlFor="workspace-name"
            error={errors.name}
            hint={canEdit ? undefined : "You don’t have permission to change this."}
          >
            <Input
              id="workspace-name"
              name="name"
              value={name}
              maxLength={60}
              disabled={!canEdit}
              onChange={(event) => setName(event.target.value)}
              invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? "workspace-name-error" : undefined}
            />
          </Field>
        </CardContent>
        {canEdit ? (
          <CardFooter className="justify-end">
            <Button type="submit" loading={submitting} disabled={!dirty}>
              {!submitting ? <Save className="size-4" /> : null}
              {submitting ? "Saving…" : "Save changes"}
            </Button>
          </CardFooter>
        ) : null}
      </form>
    </Card>
  );
}
