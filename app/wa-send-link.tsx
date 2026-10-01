"use client";

import { useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { sentByLink, unmarkMessageSent } from "@/lib/rentals/actions";
import { announceUndo } from "./undo-toast";

// "Send on WhatsApp" in one step: tapping the link opens WhatsApp with the
// text and marks the message sent at the same time — with an undo for the
// times WhatsApp was closed without sending. The next message's link then
// takes the focus, so a queue is worked through link after link.
export default function WaSendLink({
  href,
  messageId,
  assetId,
  className,
  children,
  undoLabel,
  doneLabel,
}: {
  href: string;
  messageId: string;
  assetId: string;
  className: string;
  children: ReactNode;
  undoLabel: string;
  doneLabel: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
      data-wa-send={messageId}
      onClick={() => {
        startTransition(async () => {
          const fd = new FormData();
          fd.set("messageId", messageId);
          fd.set("assetId", assetId);
          const result = await sentByLink(fd);
          if (result?.undo) {
            const fields = result.undo;
            announceUndo({
              message: doneLabel,
              undoLabel,
              run: () => {
                const data = new FormData();
                for (const [name, value] of Object.entries(fields)) data.set(name, value);
                return unmarkMessageSent(data);
              },
            });
          }
          router.refresh();
          // The next one waiting, ready for the next tap.
          setTimeout(() => {
            const next = [...document.querySelectorAll<HTMLAnchorElement>("[data-wa-send]")].find(
              (link) => link.dataset.waSend !== messageId,
            );
            next?.focus();
          }, 400);
        });
      }}
    >
      {children}
    </a>
  );
}
