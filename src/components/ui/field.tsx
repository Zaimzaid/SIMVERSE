import { cn } from "@/lib/utils";

export function Label({
  className,
  children,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn("block text-sm font-medium text-foreground", className)}
      {...props}
    >
      {children}
      {required ? <span className="ml-0.5 text-danger">*</span> : null}
    </label>
  );
}

export function FieldHint({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <p className={cn("text-xs text-muted", className)}>{children}</p>;
}

export function FieldError({
  id,
  children,
  className,
}: {
  id?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  if (!children) return null;
  return (
    <p id={id} role="alert" className={cn("text-xs font-medium text-danger", className)}>
      {children}
    </p>
  );
}

/**
 * Field wrapper: pairs a label with its control, optional hint and error.
 * Keeps forms consistent and accessible (label + error association).
 */
export function Field({
  label,
  htmlFor,
  required,
  hint,
  error,
  children,
  className,
}: {
  label?: string;
  htmlFor?: string;
  required?: boolean;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label ? (
        <Label htmlFor={htmlFor} required={required}>
          {label}
        </Label>
      ) : null}
      {children}
      {error ? (
        <FieldError id={htmlFor ? `${htmlFor}-error` : undefined}>{error}</FieldError>
      ) : hint ? (
        <FieldHint>{hint}</FieldHint>
      ) : null}
    </div>
  );
}
