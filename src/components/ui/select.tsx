import { forwardRef } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, invalid, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          aria-invalid={invalid || undefined}
          className={cn(
            "h-10 w-full appearance-none rounded-lg border bg-background/60 pl-3.5 pr-10 text-sm text-foreground transition-colors focus:outline-none focus:ring-2 focus:ring-ring/60 focus:border-accent/60 disabled:cursor-not-allowed disabled:opacity-60",
            invalid ? "border-danger/70 focus:ring-danger/40" : "border-border-strong",
            className,
          )}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted"
        />
      </div>
    );
  },
);
Select.displayName = "Select";
