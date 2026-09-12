"use client";

import { LoaderCircle, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { uploadAvatarAction } from "@/features/profile/actions/upload-avatar-action";
import {
  AVATAR_ACCEPT_ATTRIBUTE,
  AVATAR_REJECTION_MESSAGES,
  MAX_AVATAR_BYTES,
} from "@/features/profile/image-type";

interface AvatarUploadProps {
  readonly name: string;
  readonly avatarUrl: string | null;
}

export function AvatarUpload({ name, avatarUrl }: AvatarUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [current, setCurrent] = useState(avatarUrl);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function onPick(file: File | undefined): void {
    setError(null);
    setSaved(null);

    if (!file) return;

    // Checked here only to save the round trip; the server checks the bytes
    // themselves, which is the check that counts.
    if (file.size > MAX_AVATAR_BYTES) {
      setError(AVATAR_REJECTION_MESSAGES["too-large"]);
      return;
    }

    const formData = new FormData();
    formData.append("avatar", file);

    startTransition(async () => {
      const result = await uploadAvatarAction(formData);

      if (result.success && result.avatarUrl) {
        setCurrent(result.avatarUrl);
        setSaved(result.message);
      } else {
        setError(result.message);
      }

      // Clears the picker so choosing the same file twice fires again.
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      <Avatar name={name} src={current} size="lg" className="rounded-full" />

      <div className="space-y-2">
        <input
          ref={inputRef}
          id="avatar"
          type="file"
          accept={AVATAR_ACCEPT_ATTRIBUTE}
          className="sr-only"
          onChange={(event) => onPick(event.target.files?.[0])}
        />

        <Button
          type="button"
          variant="secondary"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
        >
          {isPending ? (
            <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="size-4" aria-hidden="true" />
          )}
          {current ? "Change picture" : "Upload picture"}
        </Button>

        <p className="text-muted-foreground text-xs">
          PNG, JPEG, WebP or GIF, up to{" "}
          {Math.round(MAX_AVATAR_BYTES / (1024 * 1024))} MB.
        </p>

        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}

        {saved ? (
          <p className="text-success text-sm" role="status">
            {saved}
          </p>
        ) : null}
      </div>
    </div>
  );
}
