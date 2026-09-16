"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import {
  ATTRIBUTE_DATA_TYPES,
  ATTRIBUTE_DATA_TYPE_META,
  type AttributeDataType,
} from "@/lib/entities/constants";
import { createAttributeDefinitionSchema } from "@/lib/validation";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import type { AttributeDefinitionView } from "@/server/services/attribute-service";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";

export interface CustomAttributeDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (definition: AttributeDefinitionView) => void;
}

const EMPTY = {
  name: "",
  dataType: "NUMBER" as AttributeDataType,
  unit: "",
  minimum: "",
  maximum: "",
  options: "",
  description: "",
  defaultValue: "",
};

/** Create a workspace-scoped custom attribute definition (POST /api/attributes). */
export function CustomAttributeDialog({ open, onClose, onCreated }: CustomAttributeDialogProps) {
  const { toast } = useToast();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof typeof EMPTY>(key: K, value: (typeof EMPTY)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const isNumber = form.dataType === "NUMBER";
  const isSelect = form.dataType === "SELECT";

  const parsedOptions = useMemo(
    () =>
      form.options
        .split(/[\n,]/)
        .map((o) => o.trim())
        .filter(Boolean),
    [form.options],
  );

  function reset() {
    setForm(EMPTY);
    setErrors({});
  }

  function close() {
    if (submitting) return;
    reset();
    onClose();
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload: Record<string, unknown> = {
      name: form.name,
      dataType: form.dataType,
      description: form.description.trim() || undefined,
      unit: form.unit.trim() || undefined,
    };
    if (isNumber) {
      if (form.minimum.trim() !== "") payload.minimum = Number(form.minimum);
      if (form.maximum.trim() !== "") payload.maximum = Number(form.maximum);
    }
    if (isSelect) payload.options = parsedOptions;
    if (form.defaultValue.trim() !== "") {
      payload.defaultValue = isNumber ? Number(form.defaultValue) : form.defaultValue.trim();
    }

    const parsed = createAttributeDefinitionSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { data, error } = await apiFetch<{ attribute: AttributeDefinitionView }>(
      "/api/attributes",
      { method: "POST", body: JSON.stringify(payload) },
    );
    setSubmitting(false);

    if (error) {
      if (error.details?.length) setErrors(fieldErrorsFrom(error));
      else toast({ variant: "error", title: "Couldn’t create attribute", description: error.message });
      return;
    }
    if (data?.attribute) {
      toast({ variant: "success", title: "Attribute created", description: `“${data.attribute.name}” is ready to use.` });
      onCreated(data.attribute);
      reset();
      onClose();
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New custom attribute"
      description="Custom attributes belong to this workspace only."
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <Field label="Name" htmlFor="attr-name" required error={errors.name}>
          <Input
            id="attr-name"
            value={form.name}
            maxLength={60}
            onChange={(e) => set("name", e.target.value)}
            invalid={Boolean(errors.name)}
            placeholder="e.g. Soil Fertility"
            autoFocus
          />
        </Field>

        <Field
          label="Type"
          htmlFor="attr-type"
          hint={ATTRIBUTE_DATA_TYPE_META[form.dataType].description}
          error={errors.dataType}
        >
          <Select
            id="attr-type"
            value={form.dataType}
            onChange={(e) => set("dataType", e.target.value as AttributeDataType)}
          >
            {ATTRIBUTE_DATA_TYPES.map((t) => (
              <option key={t} value={t}>
                {ATTRIBUTE_DATA_TYPE_META[t].label}
              </option>
            ))}
          </Select>
        </Field>

        {isNumber ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Minimum" htmlFor="attr-min" error={errors.minimum} hint="Optional">
              <Input
                id="attr-min"
                type="number"
                value={form.minimum}
                onChange={(e) => set("minimum", e.target.value)}
                invalid={Boolean(errors.minimum)}
                placeholder="0"
              />
            </Field>
            <Field label="Maximum" htmlFor="attr-max" error={errors.maximum} hint="Optional">
              <Input
                id="attr-max"
                type="number"
                value={form.maximum}
                onChange={(e) => set("maximum", e.target.value)}
                invalid={Boolean(errors.maximum)}
                placeholder="100"
              />
            </Field>
          </div>
        ) : null}

        {isNumber ? (
          <Field label="Unit" htmlFor="attr-unit" error={errors.unit} hint="Optional, e.g. km/h, ha, %">
            <Input
              id="attr-unit"
              value={form.unit}
              maxLength={24}
              onChange={(e) => set("unit", e.target.value)}
              invalid={Boolean(errors.unit)}
            />
          </Field>
        ) : null}

        {isSelect ? (
          <Field
            label="Choices"
            htmlFor="attr-options"
            required
            error={errors.options}
            hint="One choice per line (or comma-separated)."
          >
            <Textarea
              id="attr-options"
              value={form.options}
              onChange={(e) => set("options", e.target.value)}
              invalid={Boolean(errors.options)}
              placeholder={"Low\nMedium\nHigh"}
              rows={3}
            />
          </Field>
        ) : null}

        <Field label="Description" htmlFor="attr-desc" error={errors.description} hint="Optional">
          <Textarea
            id="attr-desc"
            value={form.description}
            maxLength={300}
            onChange={(e) => set("description", e.target.value)}
            invalid={Boolean(errors.description)}
            rows={2}
          />
        </Field>

        <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {!submitting ? <Plus className="size-4" /> : null}
            {submitting ? "Creating…" : "Create attribute"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
