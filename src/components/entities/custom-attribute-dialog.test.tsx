// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { act } from "react";
import type { ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { ToastProvider } from "@/components/ui/toast";
import { CustomAttributeDialog } from "./custom-attribute-dialog";

/**
 * Regression: Bug 2 — the "Create custom attribute" input lost focus after every
 * character. Root cause was in the shared Modal primitive: its focus effect
 * listed the `onClose` prop as a dependency. This dialog passes a fresh `onClose`
 * (`close`) on every render, so each keystroke re-ran the effect and moved focus
 * back to the dialog panel. The fix scopes that effect to the open transition
 * only. These tests render the real dialog and type into the real input.
 */

// React 19's `act` requires this flag to be set for the test environment.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(ui: ReactElement) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(ui);
  });
}

afterEach(() => {
  act(() => {
    root?.unmount();
  });
  container?.remove();
  container = null;
  root = null;
});

/** Set a controlled <input> value the way a real keystroke would, then fire React's onChange. */
function typeChar(input: HTMLInputElement, char: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
  act(() => {
    setter.call(input, input.value + char);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

/** Change a controlled <select> value and fire React's onChange. */
function selectValue(select: HTMLSelectElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")!.set!;
  act(() => {
    setter.call(select, value);
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

function nameInput(): HTMLInputElement {
  const el = document.getElementById("attr-name");
  if (!(el instanceof HTMLInputElement)) throw new Error("attr-name input not found");
  return el;
}

describe("CustomAttributeDialog focus stability (Bug 2 regression)", () => {
  it("keeps focus on the Name field through continuous typing, without remounting it", () => {
    mount(
      <ToastProvider>
        <CustomAttributeDialog open onClose={() => {}} onCreated={() => {}} />
      </ToastProvider>,
    );

    const name = nameInput();
    act(() => {
      name.focus();
    });
    expect(document.activeElement).toBe(name);

    const text = "Innovation Score";
    for (const ch of text) {
      typeChar(name, ch);
      // The exact failure the user reported: focus jumped away after each char.
      expect(document.activeElement).toBe(name);
      // The input element must be the same node — not remounted mid-typing.
      expect(document.getElementById("attr-name")).toBe(name);
    }

    expect(name.value).toBe(text);
  });

  it("preserves unrelated form state (the Name) when the Type changes", () => {
    mount(
      <ToastProvider>
        <CustomAttributeDialog open onClose={() => {}} onCreated={() => {}} />
      </ToastProvider>,
    );

    const name = nameInput();
    for (const ch of "Score") typeChar(name, ch);
    expect(name.value).toBe("Score");

    const type = document.getElementById("attr-type");
    if (!(type instanceof HTMLSelectElement)) throw new Error("attr-type select not found");

    // NUMBER (default) shows Minimum/Maximum; switching to TEXT hides them…
    expect(document.getElementById("attr-min")).not.toBeNull();
    selectValue(type, "TEXT");
    expect(document.getElementById("attr-min")).toBeNull();
    expect(document.getElementById("attr-max")).toBeNull();
    // …and the Name the user already typed survives the switch.
    expect(nameInput().value).toBe("Score");

    // Switching to SELECT reveals the Choices field, Name still intact.
    selectValue(type, "SELECT");
    expect(document.getElementById("attr-options")).not.toBeNull();
    expect(nameInput().value).toBe("Score");
  });
});
