"use client";

import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/error-state";

/**
 * Root error boundary. Next.js logs the server-side error (with its digest)
 * automatically; here we render a safe, on-brand recovery UI — never raw error
 * details — with a retry that re-renders the segment.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center px-6">
      <ErrorState
        className="max-w-lg"
        title="Something went wrong"
        description="An unexpected error occurred. You can try again — if it keeps happening, please come back in a bit."
        action={
          <Button onClick={() => reset()}>
            <RotateCw className="size-4" />
            Try again
          </Button>
        }
      />
    </main>
  );
}
