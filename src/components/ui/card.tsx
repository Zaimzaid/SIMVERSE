import { cn } from "@/lib/utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** interactive adds hover affordance (for clickable cards / links). */
  interactive?: boolean;
  as?: "div" | "article" | "section";
}

export function Card({
  className,
  interactive,
  as: Tag = "div",
  ...props
}: CardProps) {
  return (
    <Tag
      className={cn(
        "rounded-xl border border-border bg-surface",
        interactive &&
          "transition-all duration-200 hover:border-accent/40 hover:bg-surface-hover hover:shadow-[0_8px_30px_-14px_var(--accent)]",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-1 p-5", className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-base font-semibold text-foreground", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-secondary", className)} {...props} />;
}

export function CardContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex items-center gap-3 border-t border-border p-5", className)}
      {...props}
    />
  );
}
