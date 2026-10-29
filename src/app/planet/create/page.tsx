import type { Metadata } from "next";
import Link from "next/link";
import { CountryCreator } from "@/components/planet/country-creator";
import { requirePlatformContext } from "@/server/context";
import { getPlanetCreatorAccess } from "@/server/services/fictional-planet-service";

export const metadata: Metadata = {
  title: "Country Creator | SIMVERSE",
  description: "Design an original country on the SIMVERSE fictional planet.",
  robots: { index: false, follow: false },
};

export default async function CountryCreatorPage() {
  const { user, workspace } = await requirePlatformContext();
  const access = await getPlanetCreatorAccess(user.id, workspace.id);
  if (!access.canEdit) {
    return (
      <main className="grid min-h-dvh place-items-center bg-[#030b17] px-4 text-white">
        <section className="max-w-lg rounded-2xl border border-white/15 bg-[#0b1a2d] p-8">
          <h1 className="font-display text-2xl font-bold">Country Creator requires authorization</h1>
          <p className="mt-3 leading-relaxed text-slate-300">
            Only a workspace owner or administrator with an explicit SIMVERSE Planet
            steward grant may create countries. Workspace ownership alone is not a grant.
          </p>
          <p className="mt-4 text-sm text-slate-400">
            A trusted platform operator can activate an existing owner account using
            the documented steward-enrollment script. This screen never grants itself access.
          </p>
          <Link href="/planet" className="mt-6 inline-flex rounded-xl bg-cyan-300 px-4 py-3 font-semibold text-[#031522]">Back to planet</Link>
        </section>
      </main>
    );
  }
  return <CountryCreator canPublish={access.canPublish} />;
}
