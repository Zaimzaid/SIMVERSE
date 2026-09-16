import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        aria-invalid={invalid || undefined}
        className={cn(
          "w-full resize-y rounded-lg border bg-background/60 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60 focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60",
          invalid ? "border-danger/70 focus:ring-danger/40" : "border-border-strong",
          className,
        )}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";
