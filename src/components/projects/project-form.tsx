"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Save } from "lucide-react";
import { createProjectSchema, updateProjectSchema } from "@/lib/validation";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import type { ProjectView } from "@/server/services/project-service";
import { useToast } from "@/components/ui/toast";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ImageField } from "@/components/entities/image-field";
import { MetadataEditor } from "@/components/entities/metadata-editor";
import type { MetadataPair } from "@/components/entities/types";
import type { ProjectFormInitial } from "./project-form-model";

// `ProjectFormInitial` and `projectToFormInitial` live in the server-safe
// `project-form-model` module so the Server Component Edit page can build the
// initializer without calling across the client boundary. Only the (erased)
// type is re-exported here; the function is intentionally NOT re-exported so a
// Server Component can't import it from this "use client" module by mistake and
// reintroduce the boundary bug — import it from `project-form-model` instead.
export type { ProjectFormInitial } from "./project-form-model";

export interface ProjectFormProps {
  mode: "create" | "edit";
  initial?: ProjectFormInitial;
}

export function ProjectForm({ mode, initial }: ProjectFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [coverUrl, setCoverUrl] = useState(initial?.coverUrl ?? "");
  const [metadata, setMetadata] = useState<MetadataPair[]>(initial?.metadata ?? []);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function buildPayload() {
    const metadataObject: Record<string, string> = {};
    for (const pair of metadata) {
      const key = pair.key.trim();
      if (key) metadataObject[key] = pair.value;
    }
    return {
      name,
      description,
      imageUrl,
      coverUrl,
      metadata: metadataObject,
    };
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = buildPayload();

    const schema = mode === "create" ? createProjectSchema : updateProjectSchema;
    const parsed = schema.safeParse(payload);
    const nextErrors: Record<string, string> = parsed.success ? {} : zodFieldErrors(parsed.error);

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast({ variant: "error", title: "Check the form", description: "Some fields need attention." });
      return;
    }

    setErrors({});
    setSubmitting(true);

    const path = mode === "create" ? "/api/projects" : `/api/projects/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const { data, error } = await apiFetch<{ project: ProjectView }>(path, {
      method,
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (error) {
      if (error.details?.length) {
        setErrors(fieldErrorsFrom(error));
        toast({ variant: "error", title: "Couldn’t save project", description: "Some fields need attention." });
      } else {
        toast({ variant: "error", title: "Couldn’t save project", description: error.message });
      }
      return;
    }

    const saved = data?.project;
    toast({
      variant: "success",
      title: mode === "create" ? "Project created" : "Changes saved",
      description: saved ? `“${saved.name}” is ready.` : undefined,
    });
    router.push(saved ? `/projects/${saved.id}` : "/projects");
    router.refresh();
  }

  const cancelHref = mode === "edit" && initial ? `/projects/${initial.id}` : "/projects";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Identity */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Project details</CardTitle>
          <CardDescription>Name your project and describe what it’s for.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Name" htmlFor="project-name" required error={errors.name}>
            <Input
              id="project-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              invalid={Boolean(errors.name)}
              placeholder="e.g. African Anything Wars Test"
              autoFocus
            />
          </Field>
          <Field
            label="Description"
            htmlFor="project-description"
            error={errors.description}
            hint="Optional. What is this project about?"
          >
            <Textarea
              id="project-description"
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              invalid={Boolean(errors.description)}
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Give the project an icon and cover — both optional.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <ImageField
            label="Icon"
            value={imageUrl}
            onChange={setImageUrl}
            error={errors.imageUrl}
            hint="Optional. Paste an image URL, or upload a small image (under 1MB)."
          />
          <ImageField
            label="Cover image"
            value={coverUrl}
            onChange={setCoverUrl}
            error={errors.coverUrl}
            hint="Optional. A wider banner shown on the project page."
          />
        </CardContent>
      </Card>

      {/* Additional info */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Additional info</CardTitle>
          <CardDescription>Flexible extra details, stored alongside the project.</CardDescription>
        </CardHeader>
        <CardContent>
          <MetadataEditor value={metadata} onChange={setMetadata} />
        </CardContent>
      </Card>

      {/* Review / Save */}
      <div className="sticky bottom-4 z-10 flex flex-col gap-3 rounded-xl border border-border-strong bg-surface-elevated/95 p-4 shadow-2xl backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-secondary">
          {name.trim() ? (
            <>
              <span className="font-medium text-foreground">{name.trim()}</span>
              {" · "}
              Entities and simulations are added after the project is created.
            </>
          ) : (
            "Fill in a name to save this project."
          )}
        </p>
        <div className="flex items-center gap-3">
          <Link href={cancelHref} className={buttonClasses({ variant: "ghost" })}>
            Cancel
          </Link>
          <Button type="submit" loading={submitting}>
            {!submitting ? <Save className="size-4" /> : null}
            {submitting
              ? mode === "create"
                ? "Creating…"
                : "Saving…"
              : mode === "create"
                ? "Create project"
                : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
