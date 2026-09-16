"use client";

import type { LucideIcon } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

interface ComingSoonButtonProps {
  label: string;
  icon?: LucideIcon;
  variant?: ButtonVariant;
  feature?: string;
}

/** A button that acknowledges a not-yet-built feature via a toast. */
export function ComingSoonButton({
  label,
  icon: Icon,
  variant = "primary",
  feature,
}: ComingSoonButtonProps) {
  const { toast } = useToast();
  return (
    <Button
      variant={variant}
      onClick={() =>
        toast({
          variant: "info",
          title: "Coming in a future phase",
          description: feature ?? `${label} isn’t available yet.`,
        })
      }
    >
      {Icon ? <Icon className="size-4" /> : null}
      {label}
    </Button>
  );
}
