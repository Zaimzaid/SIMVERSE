"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import {
  CUSTOM_CATEGORY_KEY,
  isBuiltInCategory,
  resolveCategory,
  selectableCategories,
} from "@/lib/entities/categories";
import { coerceAttributeValue, isEmptyValue } from "@/lib/entities/attribute-values";
import { createEntitySchema, updateEntitySchema } from "@/lib/validation";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import type { AttributeDefinitionView } from "@/server/services/attribute-service";
import type { EntityView } from "@/server/services/entity-service";
import { useToast } from "@/components/ui/toast";
import { Button, buttonClasses } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ColorPicker } from "./color-picker";
import { ImageField } from "./image-field";
import { TagInput } from "./tag-input";
import { AttributeEditor } from "./attribute-editor";
import { MetadataEditor } from "./metadata-editor";
import type { AttributeAssignment, MetadataPair } from "./types";

export interface EntityFormInitial {
  id: string;
  name: string;
  shortName: string;
  description: string;
  category: string;
  imageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  attributes: AttributeAssignment[];
  tags: string[];
  metadata: MetadataPair[];
}

export interface EntityFormProps {
  mode: "create" | "edit";
  initialDefinitions: AttributeDefinitionView[];
  tagSuggestions: string[];
  initial?: EntityFormInitial;
}

/** Build the editable form initializer from a persisted entity (edit mode). */
export function entityToFormInitial(entity: EntityView): EntityFormInitial {
  return {
    id: entity.id,
    name: entity.name,
    shortName: entity.shortName ?? "",
    description: entity.description ?? "",
    category: entity.category,
    imageUrl: entity.imageUrl ?? "",
    primaryColor: entity.primaryColor ?? "",
    secondaryColor: entity.secondaryColor ?? "",
    attributes: entity.attributes.map((a) => ({
      attributeDefinitionId: a.attributeDefinitionId,
      value: a.rawValue,
    })),
    tags: entity.tags.map((t) => t.name),
    metadata: Object.entries(entity.metadata ?? {}).map(([key, val], i) => ({
      id: `meta-init-${i}`,
      key,
      value: typeof val === "string" ? val : JSON.stringify(val),
    })),
  };
}

const BUILT_IN_CHOICES = selectableCategories(false); // excludes the "custom" sentinel

export function EntityForm({ mode, initialDefinitions, tagSuggestions, initial }: EntityFormProps) {
  const router = useRouter();
  const { toast } = useToast();

  const initialCategoryIsBuiltIn =
    initial != null && isBuiltInCategory(initial.category) && initial.category !== CUSTOM_CATEGORY_KEY;

  const [name, setName] = useState(initial?.name ?? "");
  const [shortName, setShortName] = useState(initial?.shortName ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categorySelect, setCategorySelect] = useState(
    initial ? (initialCategoryIsBuiltIn ? initial.category : CUSTOM_CATEGORY_KEY) : "",
  );
  const [customCategory, setCustomCategory] = useState(
    initial && !initialCategoryIsBuiltIn ? resolveCategory(initial.category).label : "",
  );
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? "");
  const [primaryColor, setPrimaryColor] = useState(initial?.primaryColor ?? "");
  const [secondaryColor, setSecondaryColor] = useState(initial?.secondaryColor ?? "");
  const [tags, setTags] = useState<string[]>(initial?.tags ?? []);
  const [attributes, setAttributes] = useState<AttributeAssignment[]>(initial?.attributes ?? []);
  const [metadata, setMetadata] = useState<MetadataPair[]>(initial?.metadata ?? []);
  const [definitions, setDefinitions] = useState<AttributeDefinitionView[]>(initialDefinitions);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const isCustom = categorySelect === CUSTOM_CATEGORY_KEY;
  const defById = useMemo(() => new Map(definitions.map((d) => [d.id, d])), [definitions]);

  const assignedCount = attributes.filter((a) => !isEmptyValue(a.value)).length;

  function buildPayload() {
    const category = isCustom ? customCategory : categorySelect;
    const metadataObject: Record<string, string> = {};
    for (const pair of metadata) {
      const key = pair.key.trim();
      if (key) metadataObject[key] = pair.value;
    }
    const attributePayload = attributes
      .filter((a) => !isEmptyValue(a.value))
      .map((a) => ({ attributeDefinitionId: a.attributeDefinitionId, value: a.value }));

    return {
      name,
      shortName,
      description,
      category,
      imageUrl,
      primaryColor,
      secondaryColor,
      attributes: attributePayload,
      tags,
      metadata: metadataObject,
    };
  }

  /** Validate assigned attribute values client-side; returns true when all ok. */
  function attributesValid(): boolean {
    for (const a of attributes) {
      if (isEmptyValue(a.value)) continue;
      const def = defById.get(a.attributeDefinitionId);
      if (!def) continue;
      const result = coerceAttributeValue(
        { dataType: def.dataType, minimum: def.minimum, maximum: def.maximum, options: def.options },
        a.value,
      );
      if (!result.ok) return false;
    }
    return true;
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const payload = buildPayload();

    const schema = mode === "create" ? createEntitySchema : updateEntitySchema;
    const parsed = schema.safeParse(payload);
    const nextErrors: Record<string, string> = parsed.success ? {} : zodFieldErrors(parsed.error);

    if (!attributesValid()) {
      nextErrors.attributes = "Fix the highlighted attribute values before saving.";
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      toast({ variant: "error", title: "Check the form", description: "Some fields need attention." });
      return;
    }

    setErrors({});
    setSubmitting(true);

    const path = mode === "create" ? "/api/entities" : `/api/entities/${initial?.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const { data, error } = await apiFetch<{ entity: EntityView }>(path, {
      method,
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (error) {
      if (error.details?.length) {
        setErrors(fieldErrorsFrom(error));
        toast({ variant: "error", title: "Couldn’t save entity", description: "Some fields need attention." });
      } else {
        toast({ variant: "error", title: "Couldn’t save entity", description: error.message });
      }
      return;
    }

    const saved = data?.entity;
    toast({
      variant: "success",
      title: mode === "create" ? "Entity created" : "Changes saved",
      description: saved ? `“${saved.name}” is ready.` : undefined,
    });
    router.push(saved ? `/entities/${saved.id}` : "/entities");
    router.refresh();
  }

  const cancelHref = mode === "edit" && initial ? `/entities/${initial.id}` : "/entities";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Identity */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Identity</CardTitle>
          <CardDescription>What is this entity called?</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Name" htmlFor="entity-name" required error={errors.name}>
            <Input
              id="entity-name"
              value={name}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              invalid={Boolean(errors.name)}
              placeholder="e.g. Nigeria, Titan X, Greenheart Farm"
              autoFocus
            />
          </Field>
          <Field
            label="Short name"
            htmlFor="entity-short-name"
            error={errors.shortName}
            hint="Optional. A compact label used where space is tight."
          >
            <Input
              id="entity-short-name"
              value={shortName}
              maxLength={40}
              onChange={(e) => setShortName(e.target.value)}
              invalid={Boolean(errors.shortName)}
            />
          </Field>
          <Field
            label="Description"
            htmlFor="entity-description"
            error={errors.description}
            hint="Optional. What is this entity, in a sentence or two?"
          >
            <Textarea
              id="entity-description"
              value={description}
              maxLength={2000}
              onChange={(e) => setDescription(e.target.value)}
              invalid={Boolean(errors.description)}
              rows={3}
            />
          </Field>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Classification</CardTitle>
          <CardDescription>Pick a category, then tag it for easy discovery.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Category" htmlFor="entity-category" required error={errors.category}>
            <Select
              id="entity-category"
              value={categorySelect}
              onChange={(e) => setCategorySelect(e.target.value)}
              invalid={Boolean(errors.category)}
            >
              <option value="">Choose a category…</option>
              {BUILT_IN_CHOICES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
              <option value={CUSTOM_CATEGORY_KEY}>Custom…</option>
            </Select>
          </Field>

          {isCustom ? (
            <Field
              label="Custom category"
              htmlFor="entity-custom-category"
              required
              error={errors.category}
              hint="Name your own kind of entity — anything can live in a SIMVERSE world."
            >
              <Input
                id="entity-custom-category"
                value={customCategory}
                maxLength={60}
                onChange={(e) => setCustomCategory(e.target.value)}
                invalid={Boolean(errors.category)}
                placeholder="e.g. Spaceship, Recipe, Planet"
              />
            </Field>
          ) : null}

          <Field label="Tags" error={errors.tags} hint="Press Enter or comma to add. Up to 30.">
            <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />
          </Field>
        </CardContent>
      </Card>

      {/* Appearance */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>Give the entity a look — colors and an optional image.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <ColorPicker
              label="Primary color"
              value={primaryColor}
              onChange={setPrimaryColor}
              hint={errors.primaryColor ?? "Optional. Stored as hex, e.g. #22D3EE."}
            />
            <ColorPicker
              label="Secondary color"
              value={secondaryColor}
              onChange={setSecondaryColor}
              hint={errors.secondaryColor ?? "Optional."}
            />
          </div>
          <ImageField
            label="Image or reference"
            value={imageUrl}
            onChange={setImageUrl}
            error={errors.imageUrl}
            hint="Optional. Paste an image URL, or upload a small image (under 1MB)."
          />
        </CardContent>
      </Card>

      {/* Attributes */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Attributes</CardTitle>
          <CardDescription>
            Traits and stats for this entity. Attributes are yours to define — nothing is required.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {errors.attributes ? (
            <p role="alert" className="text-xs font-medium text-danger">
              {errors.attributes}
            </p>
          ) : null}
          <AttributeEditor
            definitions={definitions}
            value={attributes}
            onChange={setAttributes}
            onDefinitionsChange={setDefinitions}
          />
        </CardContent>
      </Card>

      {/* Additional info */}
      <Card as="section">
        <CardHeader>
          <CardTitle>Additional info</CardTitle>
          <CardDescription>Flexible extra details, stored alongside the entity.</CardDescription>
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
              {assignedCount} attribute{assignedCount === 1 ? "" : "s"} · {tags.length} tag
              {tags.length === 1 ? "" : "s"}
            </>
          ) : (
            "Fill in a name to save this entity."
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
                ? "Create entity"
                : "Save changes"}
          </Button>
        </div>
      </div>
    </form>
  );
}
