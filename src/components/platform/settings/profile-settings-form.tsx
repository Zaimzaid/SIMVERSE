"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { updateProfileSchema } from "@/lib/validation";
import { apiFetch, fieldErrorsFrom } from "@/lib/client/api";
import { zodFieldErrors } from "@/lib/client/form";
import { useToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/avatar";
import {ImageUpload} from "./image-upload";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface ProfileSettingsFormProps {
  initialDisplayName: string;
  initialAvatarUrl: string;
  email: string;
}

/**
 * Update the current user's profile (display name + avatar). PATCH /api/profile
 * is authoritative; on success we refresh so the top bar avatar/name update.
 */
export function ProfileSettingsForm({
  initialDisplayName,
  initialAvatarUrl,
  email,
}: ProfileSettingsFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [saved, setSaved] = useState({ displayName: initialDisplayName, avatarUrl: initialAvatarUrl });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const dirty =
    displayName.trim() !== saved.displayName.trim() ||
    avatarUrl.trim() !== saved.avatarUrl.trim();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      displayName,
      avatarUrl: avatarUrl.trim() === "" ? "" : avatarUrl.trim(),
    };
    const parsed = updateProfileSchema.safeParse(payload);
    if (!parsed.success) {
      setErrors(zodFieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const { data, error } = await apiFetch<{
      user: { displayName: string; avatarUrl: string | null };
    }>("/api/profile", { method: "PATCH", body: JSON.stringify(payload) });
    setSubmitting(false);

    if (error) {
      if (error.details?.length) setErrors(fieldErrorsFrom(error));
      else toast({ variant: "error", title: "Couldn’t save changes", description: error.message });
      return;
    }

    const nextName = data?.user.displayName ?? displayName.trim();
    const nextAvatar = data?.user.avatarUrl ?? "";
    setDisplayName(nextName);
    setAvatarUrl(nextAvatar);
    setSaved({ displayName: nextName, avatarUrl: nextAvatar });
    toast({
      variant: "success",
      title: "Profile updated",
      description: "Your changes have been saved.",
    });
    router.refresh();
  }

  return (
    <Card as="section">
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear across SIMVERSE.</CardDescription>
      </CardHeader>
      <form onSubmit={onSubmit}>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <Avatar
              name={displayName || "You"}
              src={avatarUrl.trim() || null}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {displayName || "Your name"}
              </p>
              <p className="truncate text-sm text-secondary">{email}</p>
            </div>
          </div>

          <Field label="Display name" htmlFor="display-name" error={errors.displayName}>
            <Input
              id="display-name"
              name="displayName"
              value={displayName}
              maxLength={60}
              onChange={(event) => setDisplayName(event.target.value)}
              invalid={Boolean(errors.displayName)}
              aria-describedby={errors.displayName ? "display-name-error" : undefined}
            />
          </Field>

          <ImageUpload endpoint="/api/account/avatar" label="Upload a profile picture" onUploaded={url=>{
            setAvatarUrl(url);setSaved(s=>({...s,avatarUrl:url}));toast({variant:"success",title:"Profile picture uploaded"});
          }}/>
          <Field
            label="Avatar URL"
            htmlFor="avatar-url"
            error={errors.avatarUrl}
            hint="Optional. You can upload an image above, paste an image URL, or leave blank for initials."
          >
            <Input
              id="avatar-url"
              name="avatarUrl"
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              invalid={Boolean(errors.avatarUrl)}
              aria-describedby={errors.avatarUrl ? "avatar-url-error" : undefined}
            />
          </Field>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" loading={submitting} disabled={!dirty}>
            {!submitting ? <Save className="size-4" /> : null}
            {submitting ? "Saving…" : "Save changes"}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
