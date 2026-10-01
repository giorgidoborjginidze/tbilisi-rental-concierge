"use client";

// Adding files: pick one or several (on a phone, the camera too), choose
// what they are, and they upload one by one. Photos are shrunk in the
// browser first (longest side 1800 px), so a 12 MB phone photo arrives as
// a few hundred KB and the free storage lasts.

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT, FILE_KINDS, MAX_FILE_BYTES, PHOTO_MAX_SIDE, type FileKind } from "@/lib/files/rules";

async function shrinkPhoto(file: File): Promise<File> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, PHOTO_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
      bitmap.close();
      return file;
    }
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.(png|webp|jpe?g)$/i, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export default function FileUploader({
  place,
  defaultKind,
  labels,
}: {
  place: { assetId: string } | { unitId: string };
  defaultKind: FileKind;
  labels: Record<string, string>;
}) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<FileKind>(defaultKind);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const upload = async (list: FileList | null) => {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    const problems: string[] = [];
    let done = 0;
    for (const [index, original] of files.entries()) {
      setBusy(labels.files_uploading.replace("{n}", String(index + 1)).replace("{total}", String(files.length)));
      const file = kind === "photo" || original.type.startsWith("image/") ? await shrinkPhoto(original) : original;
      if (file.size > MAX_FILE_BYTES) {
        problems.push(`${original.name}: ${labels.files_too_big}`);
        continue;
      }
      const body = new FormData();
      body.set("file", file);
      body.set("kind", kind);
      for (const [key, value] of Object.entries(place)) body.set(key, value);
      const response = await fetch("/api/files", { method: "POST", body }).catch(() => null);
      const result = (await response?.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
      if (result?.ok) done += 1;
      else {
        problems.push(`${original.name}: ${labels[result?.error ?? "files_failed"] ?? labels.files_failed}`);
        // The account's space or the place's limit is full: the rest would fail too.
        if (result?.error === "files_quota" || result?.error === "files_too_many") break;
      }
    }
    setBusy(null);
    if (input.current) input.current.value = "";
    setMessage(problems.length ? problems.join(" · ") : labels.files_done.replace("{n}", String(done)));
    if (done > 0) router.refresh();
  };

  return (
    <div className="files-upload">
      <label className="field" style={{ minWidth: 150 }}>
        {labels.files_kind}
        <select value={kind} onChange={(event) => setKind(event.target.value as FileKind)} disabled={!!busy}>
          {FILE_KINDS.map((value) => (
            <option key={value} value={value}>
              {labels[`files_kind_${value}`]}
            </option>
          ))}
        </select>
      </label>
      <label className={`btn-secondary files-upload__pick${busy ? " is-busy" : ""}`} aria-disabled={!!busy || undefined}>
        {busy ?? labels.files_add}
        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          multiple
          disabled={!!busy}
          onChange={(event) => upload(event.target.files)}
          className="visually-hidden"
        />
      </label>
      {message && (
        <p role="status" className="field-hint files-upload__note">
          {message}
        </p>
      )}
    </div>
  );
}
