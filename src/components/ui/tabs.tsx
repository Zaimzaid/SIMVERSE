"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
}

export interface TabsProps {
  items: TabItem[];
  defaultTab?: string;
  className?: string;
}

/** Simple accessible tabs (uncontrolled). */
export function Tabs({ items, defaultTab, className }: TabsProps) {
  const [active, setActive] = useState(defaultTab ?? items[0]?.id ?? "");
  const activeItem = items.find((i) => i.id === active) ?? items[0];

  return (
    <div className={className}>
      <div
        role="tablist"
        className="flex items-center gap-1 border-b border-border"
      >
        {items.map((item) => {
          const selected = item.id === activeItem?.id;
          return (
            <button
              key={item.id}
              role="tab"
              type="button"
              aria-selected={selected}
              onClick={() => setActive(item.id)}
              className={cn(
                "relative -mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
                selected
                  ? "border-accent text-foreground"
                  : "border-transparent text-secondary hover:text-foreground",
              )}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="pt-5">
        {activeItem?.content}
      </div>
    </div>
  );
}
