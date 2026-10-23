import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NotFoundError } from "@/lib/errors";
import { env } from "@/lib/env";
import { shareImagePath } from "@/lib/media/share/constants";
import { getPublicMediaShare } from "@/server/services/media-share-service";
import { PublicShareView } from "@/components/media/public-share-view";

interface PageProps { params: Promise<{ publicId: string }> }

function ogImageUrl(publicId: string): string {
  return `${env.APP_URL}${shareImagePath(publicId)}?type=result-card&format=png&ratio=LANDSCAPE_16_9`;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { publicId } = await params;
  try {
    const share = await getPublicMediaShare(publicId);
    const title = share.artifact.title;
    const description = share.artifact.subtitle ?? share.result.detail;
    const image = ogImageUrl(publicId);
    // UNLISTED must never be indexed; PUBLIC may be.
    const indexable = share.visibility === "PUBLIC";
    return {
      title,
      description,
      robots: indexable ? { index: true, follow: true } : { index: false, follow: false },
      openGraph: { title, description, type: "website", images: [{ url: image, width: 1920, height: 1080 }] },
      twitter: { card: "summary_large_image", title, description, images: [image] },
    };
  } catch {
    return { title: "Not available", robots: { index: false, follow: false } };
  }
}

export default async function PublicSharePage({ params }: PageProps) {
  const { publicId } = await params;
  let share;
  try {
    share = await getPublicMediaShare(publicId);
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
  return <PublicShareView share={share} publicId={publicId} />;
}
