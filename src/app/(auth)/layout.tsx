import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BRAND_NAME } from "@/lib/brand";

/** Centered, cinematic shell for the login/register pages. */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4 py-10">
      <div className="aurora" aria-hidden="true" />
      <div className="absolute inset-0 grid-overlay" aria-hidden="true" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label={`${BRAND_NAME} home`}>
            <Logo size="lg" asStatic />
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
