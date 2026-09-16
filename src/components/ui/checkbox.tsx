import { forwardRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

/** Accessible checkbox: a real input (peer) with a styled visual box. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const control = (
      <span className="relative inline-flex">
        <input
          ref={ref}
          id={id}
          type="checkbox"
          className="peer size-5 shrink-0 cursor-pointer appearance-none rounded-md border border-border-strong bg-background/60 transition-colors checked:border-accent checked:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60"
          {...props}
        />
        <Check
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 text-accent-foreground opacity-0 peer-checked:opacity-100"
          strokeWidth={3}
        />
      </span>
    );

    if (!label) return <span className={className}>{control}</span>;

    return (
      <label
        htmlFor={id}
        className={cn(
          "inline-flex cursor-pointer items-center gap-2.5 text-sm text-secondary",
          className,
        )}
      >
        {control}
        <span>{label}</span>
      </label>
    );
  },
);
Checkbox.displayName = "Checkbox";
