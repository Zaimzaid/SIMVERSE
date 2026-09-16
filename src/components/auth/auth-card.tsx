import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <Card className="p-6 shadow-2xl sm:p-8">
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl font-semibold text-foreground">{title}</h1>
        <p className="mt-1.5 text-sm text-secondary">{subtitle}</p>
      </div>
      {children}
      {footer ? (
        <p className="mt-6 text-center text-sm text-secondary">{footer}</p>
      ) : null}
    </Card>
  );
}

/** Form-level (non-field) error banner. */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2.5 rounded-lg border border-danger/30 bg-danger-soft px-3.5 py-2.5 text-sm text-danger"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}
