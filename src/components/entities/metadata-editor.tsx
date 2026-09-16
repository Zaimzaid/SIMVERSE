"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MetadataPair } from "./types";

export interface MetadataEditorProps {
  value: MetadataPair[];
  onChange: (next: MetadataPair[]) => void;
}

let seq = 0;
function nextId() {
  seq += 1;
  return `meta-${Date.now()}-${seq}`;
}

/** Flexible key/value editor for an entity's secondary "Additional Info" (stored as JSON metadata). */
export function MetadataEditor({ value, onChange }: MetadataEditorProps) {
  function update(id: string, patch: Partial<MetadataPair>) {
    onChange(value.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }
  function remove(id: string) {
    onChange(value.filter((p) => p.id !== id));
  }
  function add() {
    onChange([...value, { id: nextId(), key: "", value: "" }]);
  }

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-surface/40 px-4 py-5 text-center text-sm text-muted">
          Optional. Add any extra details that don’t fit a formal attribute — origin, notes,
          references, and so on.
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((pair) => (
            <li key={pair.id} className="flex items-center gap-2">
              <Input
                aria-label="Field name"
                placeholder="Label"
                value={pair.key}
                maxLength={60}
                onChange={(e) => update(pair.id, { key: e.target.value })}
                className="max-w-[40%]"
              />
              <Input
                aria-label="Field value"
                placeholder="Value"
                value={pair.value}
                maxLength={500}
                onChange={(e) => update(pair.id, { value: e.target.value })}
              />
              <button
                type="button"
                onClick={() => remove(pair.id)}
                aria-label="Remove field"
                className="shrink-0 rounded-md p-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="secondary" size="sm" onClick={add}>
        <Plus className="size-4" />
        Add field
      </Button>
    </div>
  );
}
