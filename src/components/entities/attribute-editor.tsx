"use client";

import { useState } from "react";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { ATTRIBUTE_PRESETS } from "@/lib/entities/attribute-presets";
import { coerceAttributeValue, isEmptyValue } from "@/lib/entities/attribute-values";
import { ATTRIBUTE_DATA_TYPE_META } from "@/lib/entities/constants";
import { apiFetch } from "@/lib/client/api";
import type { AttributeDefinitionView } from "@/server/services/attribute-service";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Dropdown, DropdownItem, DropdownLabel, DropdownSeparator } from "@/components/ui/dropdown";
import { FieldError, Label } from "@/components/ui/field";
import { CustomAttributeDialog } from "./custom-attribute-dialog";
import type { AttributeAssignment } from "./types";

export interface AttributeEditorProps {
  definitions: AttributeDefinitionView[];
  value: AttributeAssignment[];
  onChange: (next: AttributeAssignment[]) => void;
  /** Called when a preset is materialized or a custom attribute is created. */
  onDefinitionsChange: (definitions: AttributeDefinitionView[]) => void;
}

/**
 * Assign attribute values to an entity. Attributes are workspace definitions
 * (built-in presets the user opts into, or custom ones). Values are validated by
 * type on the client for fast feedback; the server re-validates authoritatively.
 */
export function AttributeEditor({
  definitions,
  value,
  onChange,
  onDefinitionsChange,
}: AttributeEditorProps) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busyPreset, setBusyPreset] = useState<string | null>(null);

  const defById = new Map(definitions.map((d) => [d.id, d]));
  const assignedIds = new Set(value.map((v) => v.attributeDefinitionId));

  const available = definitions
    .filter((d) => !assignedIds.has(d.id))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Presets not yet materialized as a workspace definition.
  const presetsToOffer = ATTRIBUTE_PRESETS.filter(
    (p) => !definitions.some((d) => d.key === p.key),
  );

  function assignDefinition(def: AttributeDefinitionView) {
    if (assignedIds.has(def.id)) return;
    onChange([...value, { attributeDefinitionId: def.id, value: def.defaultValue ?? "" }]);
  }

  function updateValue(id: string, next: string) {
    onChange(value.map((v) => (v.attributeDefinitionId === id ? { ...v, value: next } : v)));
  }

  function removeAssignment(id: string) {
    onChange(value.filter((v) => v.attributeDefinitionId !== id));
  }

  async function addPreset(presetKey: string) {
    setBusyPreset(presetKey);
    const { data, error } = await apiFetch<{ attribute: AttributeDefinitionView }>(
      "/api/attributes",
      { method: "POST", body: JSON.stringify({ preset: presetKey }) },
    );
    setBusyPreset(null);

    if (error || !data?.attribute) {
      toast({ variant: "error", title: "Couldn’t add preset", description: error?.message });
      return;
    }
    const def = data.attribute;
    const nextDefs = definitions.some((d) => d.id === def.id)
      ? definitions
      : [...definitions, def];
    onDefinitionsChange(nextDefs);
    if (!value.some((v) => v.attributeDefinitionId === def.id)) {
      onChange([...value, { attributeDefinitionId: def.id, value: def.defaultValue ?? "" }]);
    }
  }

  function onCustomCreated(def: AttributeDefinitionView) {
    onDefinitionsChange([...definitions, def]);
    onChange([...value, { attributeDefinitionId: def.id, value: def.defaultValue ?? "" }]);
  }

  return (
    <div className="space-y-4">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface/40 px-4 py-6 text-center text-sm text-muted">
          No attributes yet. Add a preset stat or create a custom attribute — every entity
          defines its own traits.
        </p>
      ) : (
        <ul className="space-y-3">
          {value.map((assignment) => {
            const def = defById.get(assignment.attributeDefinitionId);
            if (!def) return null;
            return (
              <li
                key={assignment.attributeDefinitionId}
                className="rounded-xl border border-border bg-surface/60 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-foreground">{def.name}</span>
                      <Badge variant="outline">{ATTRIBUTE_DATA_TYPE_META[def.dataType].label}</Badge>
                      {def.isBuiltIn ? <Badge variant="neutral">Preset</Badge> : null}
                    </div>
                    {def.description ? (
                      <p className="mt-1 text-xs text-muted">{def.description}</p>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAssignment(assignment.attributeDefinitionId)}
                    aria-label={`Remove ${def.name}`}
                    className="shrink-0 rounded-md p-1.5 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="mt-3">
                  <AttributeValueInput
                    definition={def}
                    value={assignment.value}
                    onChange={(next) => updateValue(assignment.attributeDefinitionId, next)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Dropdown
          align="start"
          trigger={({ toggle }) => (
            <Button type="button" variant="secondary" size="sm" onClick={toggle}>
              <Plus className="size-4" />
              Add attribute
            </Button>
          )}
          menuClassName="w-64 max-h-80 overflow-y-auto"
        >
          {available.length > 0 ? (
            <>
              <DropdownLabel>Workspace attributes</DropdownLabel>
              {available.map((def) => (
                <DropdownItem key={def.id} onClick={() => assignDefinition(def)}>
                  {def.name}
                </DropdownItem>
              ))}
            </>
          ) : null}

          {presetsToOffer.length > 0 ? (
            <>
              {available.length > 0 ? <DropdownSeparator /> : null}
              <DropdownLabel>Presets</DropdownLabel>
              {presetsToOffer.map((preset) => (
                <DropdownItem
                  key={preset.key}
                  onClick={() => addPreset(preset.key)}
                  disabled={busyPreset === preset.key}
                >
                  <Sparkles className="size-4 text-accent" />
                  {preset.name}
                </DropdownItem>
              ))}
            </>
          ) : null}

          {available.length > 0 || presetsToOffer.length > 0 ? <DropdownSeparator /> : null}
          <DropdownItem onClick={() => setDialogOpen(true)}>
            <Plus className="size-4" />
            Create custom attribute…
          </DropdownItem>
        </Dropdown>

        {available.length === 0 && presetsToOffer.length === 0 ? (
          <span className="text-xs text-muted">All workspace attributes are assigned.</span>
        ) : null}
      </div>

      <CustomAttributeDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreated={onCustomCreated}
      />
    </div>
  );
}

function AttributeValueInput({
  definition,
  value,
  onChange,
}: {
  definition: AttributeDefinitionView;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = `attr-value-${definition.id}`;

  // Live, type-aware validation feedback (server remains authoritative).
  let error: string | null = null;
  if (!isEmptyValue(value)) {
    const result = coerceAttributeValue(
      {
        dataType: definition.dataType,
        minimum: definition.minimum,
        maximum: definition.maximum,
        options: definition.options,
      },
      value,
    );
    if (!result.ok) error = result.message;
  }

  const rangeHint =
    definition.dataType === "NUMBER" && (definition.minimum != null || definition.maximum != null)
      ? `Range ${definition.minimum ?? "−∞"} – ${definition.maximum ?? "∞"}`
      : null;

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="sr-only">
        {definition.name} value
      </Label>

      {definition.dataType === "SELECT" ? (
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={Boolean(error)}
        >
          <option value="">— Not set —</option>
          {(definition.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </Select>
      ) : definition.dataType === "BOOLEAN" ? (
        <Select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          invalid={Boolean(error)}
        >
          <option value="">— Not set —</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </Select>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type={definition.dataType === "NUMBER" ? "number" : "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            invalid={Boolean(error)}
            min={definition.minimum ?? undefined}
            max={definition.maximum ?? undefined}
            placeholder={definition.dataType === "NUMBER" ? "0" : "Value"}
            className="max-w-xs"
          />
          {definition.unit ? (
            <span className="shrink-0 text-sm text-muted">{definition.unit}</span>
          ) : null}
        </div>
      )}

      {error ? (
        <FieldError>{error}</FieldError>
      ) : rangeHint ? (
        <p className="text-xs text-muted">{rangeHint}</p>
      ) : null}
    </div>
  );
}
