import Image from "next/image";
import { initials as toInitials } from "@/lib/utils";
import { cn } from "@/lib/utils";

export type AvatarSize = "sm" | "md" | "lg";

const SIZES: Record<AvatarSize, { box: string; text: string; px: number }> = {
  sm: { box: "size-8", text: "text-xs", px: 32 },
  md: { box: "size-10", text: "text-sm", px: 40 },
  lg: { box: "size-16", text: "text-xl", px: 64 },
};

export interface AvatarProps {
  name: string;
  src?: string | null;
  size?: AvatarSize;
  className?: string;
}

/** User/workspace avatar: image when available, gradient initials otherwise. */
export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const dims = SIZES[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-border-strong",
        dims.box,
        className,
      )}
    >
      {src ? (
        <Image
          src={src}
          alt={name}
          width={dims.px}
          height={dims.px}
          unoptimized
          className="size-full object-cover"
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-full items-center justify-center bg-gradient-to-br from-accent/25 to-purple/25 font-semibold text-foreground",
            dims.text,
          )}
        >
          {toInitials(name)}
        </span>
      )}
      <span className="sr-only">{name}</span>
    </span>
  );
}
