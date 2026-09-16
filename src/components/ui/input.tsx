import { forwardRef } from "react";
import { cn } from "@/lib/utils";

const CONTROL_BASE =
  "w-full rounded-lg border bg-background/60 px-3.5 text-sm text-foreground placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60 focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          CONTROL_BASE,
          "h-10",
          invalid ? "border-danger/70 focus:ring-danger/40" : "border-border-strong",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";
