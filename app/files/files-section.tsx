import { prisma } from "@/lib/db";
import { t, type Locale } from "@/lib/i18n/strings";
import { tbilisiFormat } from "@/lib/time";
import { filesConfigured } from "@/lib/files/store";
import { ACCOUNT_QUOTA_BYTES, FILE_KINDS, formatBytes, isViewableImage, type FileKind } from "@/lib/files/rules";
import { deleteAttachment, restoreAttachment } from "@/lib/files/actions";
import ConfirmAction from "@/app/confirm-action";
import { IconClose } from "@/app/icons";
import FileUploader from "./uploader";

// Documents and photos of one asset or unit: the contract's scan, the
// tenant's ID copy, the car's technical passport, receipts, photos of the
// state it was handed over in. Shown only to the account that keeps them.

const KIND_LABEL = {
  photo: "files_kind_photo",
  document: "files_kind_document",
  receipt: "files_kind_receipt",
} as const;

export default async function FilesSection({
  place,
  locale,
  operatorId,
  readOnly,
  defaultKind = "photo",
}: {
  place: { assetId: string } | { unitId: string };
  locale: Locale;
  operatorId: string;
  /** The demo: it shows what is there and keeps the buttons quiet. */
  readOnly: boolean;
  defaultKind?: FileKind;
}) {
  const [files, used] = await Promise.all([
    prisma.attachment.findMany({
      where: { operatorId, ...place },
      orderBy: { createdAt: "desc" },
      select: { id: true, kind: true, name: true, contentType: true, size: true, createdAt: true },
    }),
    prisma.attachment.aggregate({ where: { operatorId }, _sum: { size: true } }),
  ]);
  const ready = filesConfigured();
  const fmtDate = tbilisiFormat(locale, { day: "numeric", month: "short", year: "numeric" });
  const groups = FILE_KINDS.map((kind) => ({ kind, files: files.filter((file) => file.kind === kind) })).filter(
    (group) => group.files.length > 0,
  );
  const labelKeys = [
    "files_add", "files_kind", "files_kind_photo", "files_kind_document", "files_kind_receipt",
    "files_uploading", "files_too_big", "files_bad_type", "files_too_many", "files_quota", "files_failed",
    "files_not_ready", "error_demo_readonly", "files_done",
  ] as const;
  const labels = Object.fromEntries(labelKeys.map((key) => [key, t(locale, key)]));

  const remove = (file: { id: string; name: string }) => (
    <ConfirmAction
      action={deleteAttachment}
      undo={{ action: restoreAttachment, label: t(locale, "decide_undo"), done: t(locale, "files_deleted_undo") }}
      fields={{ id: file.id }}
      trigger={<IconClose size={15} />}
      ariaLabel={`${t(locale, "delete")}: ${file.name}`}
      question={t(locale, "files_delete_q")}
      confirmLabel={t(locale, "delete")}
      cancelLabel={t(locale, "cancel")}
      inline
    />
  );

  return (
    <section id="files" style={{ scrollMarginTop: 80 }}>
      <h2>
        {t(locale, "files_title")}
        {files.length > 0 && <span className="files-count"> · {files.length}</span>}
      </h2>
      <p className="field-hint" style={{ margin: "0 0 12px" }}>{t(locale, "files_hint")}</p>

      {!readOnly && ready && (
        <FileUploader place={place} defaultKind={defaultKind} labels={labels} />
      )}
      {!ready && <p className="field-hint">{t(locale, "files_not_ready")}</p>}

      {files.length === 0 ? (
        <p className="files-empty">{t(locale, "files_empty")}</p>
      ) : (
        groups.map((group) => (
          <div key={group.kind} className="files-group">
            <h3>{t(locale, KIND_LABEL[group.kind])}</h3>
            {group.kind === "photo" ? (
              <ul className="files-grid">
                {group.files.map((file) => (
                  <li key={file.id} className="files-thumb">
                    <a href={`/api/files/${file.id}`} target="_blank" rel="noopener" title={file.name}>
                      {isViewableImage(file.contentType) ? (
                        // eslint-disable-next-line @next/next/no-img-element -- a private file, not an optimisable public image
                        <img src={`/api/files/${file.id}`} alt={file.name} loading="lazy" />
                      ) : (
                        <span className="files-thumb__name">{file.name}</span>
                      )}
                    </a>
                    {!readOnly && <span className="files-thumb__remove">{remove(file)}</span>}
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="files-list">
                {group.files.map((file) => (
                  <li key={file.id}>
                    <a href={`/api/files/${file.id}`} target="_blank" rel="noopener" className="files-list__name">
                      {file.name}
                    </a>
                    <span className="files-list__meta">
                      {formatBytes(file.size, locale)} · {fmtDate.format(file.createdAt)}
                    </span>
                    <a href={`/api/files/${file.id}?download=1`} className="btn-chip">{t(locale, "files_download")}</a>
                    {!readOnly && remove(file)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
      {files.length > 0 && (
        <p className="field-hint" style={{ marginTop: 10 }}>
          {t(locale, "files_usage")
            .replace("{used}", formatBytes(used._sum.size ?? 0, locale))
            .replace("{total}", formatBytes(ACCOUNT_QUOTA_BYTES, locale))}
        </p>
      )}
    </section>
  );
}
