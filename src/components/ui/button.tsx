import { forwardRef } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "icon";
export type ButtonSize = "sm" | "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-50 select-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground hover:bg-accent-hover shadow-[0_4px_20px_-6px_var(--accent)] hover:shadow-[0_6px_28px_-6px_var(--accent)] active:translate-y-px font-semibold",
  secondary:
    "bg-surface-elevated text-foreground border border-border-strong hover:bg-surface-hover hover:border-accent/40",
  ghost:
    "bg-transparent text-secondary hover:bg-surface-hover hover:text-foreground",
  danger:
    "bg-danger-strong text-danger-foreground hover:brightness-110 active:translate-y-px font-semibold",
  icon: "bg-transparent text-secondary hover:bg-surface-hover hover:text-foreground",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

const ICON_SIZES: Record<ButtonSize, string> = {
  sm: "size-8",
  md: "size-10",
  lg: "size-12",
};

export interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
}

/** Shared class builder so <Link> and <a> can adopt button styling too. */
export function buttonClasses({
  variant = "primary",
  size = "md",
  className,
}: ButtonStyleProps = {}): string {
  return cn(
    BASE,
    VARIANTS[variant],
    variant === "icon" ? ICON_SIZES[size] : SIZES[size],
    className,
  );
}

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonStyleProps {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      className,
      loading = false,
      disabled,
      children,
      type = "button",
      ...props
    },
    ref,
  ) => {
    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        className={buttonClasses({ variant, size, className })}
        {...props}
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : null}
        {children}
      </button>
    );
  },
);
Button.displayName = "Button";
