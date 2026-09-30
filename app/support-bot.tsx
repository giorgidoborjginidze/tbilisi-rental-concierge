"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { IconChat, IconClose } from "./icons";
import { OPEN_SUPPORT } from "./nav-events";
import { supportLauncherHidden, type BotFaqId } from "@/lib/nav/support";

// FAQ the bot can answer on its own. Each entry maps to bot_q_<id> / bot_a_<id>
// strings and carries keywords (both languages) for free-text matching.
const BOT_FAQ: { id: BotFaqId; keywords: string[] }[] = [
  { id: "what", keywords: ["what is", "about", "activo", "რა არის", "შესახებ", "პლატფორმ"] },
  { id: "pricing", keywords: ["price", "cost", "how much", "fee", "plan", "subscription", "free month", "ფას", "ღირ", "თვე", "პაკეტ", "გადასახად", "ფასი"] },
  { id: "sync", keywords: ["sync", "calendar", "airbnb", "booking", "ical", "double", "სინქრ", "კალენდ", "ჯავშ"] },
  { id: "payment", keywords: ["pay", "payment", "card", "apple pay", "google pay", "checkout", "გადახდ", "ბარათ", "გადავიხად"] },
  { id: "security", keywords: ["safe", "secure", "security", "privacy", "data", "დაცვ", "უსაფრთხ", "მონაცემ", "დაცული"] },
  { id: "calc", keywords: ["calculator", "invest", "yield", "კალკულ", "საინვესტ", "მოგება"] },
];

/**
 * The bot's words, looked up on the server (app/layout.tsx) and passed in —
 * the page never ships the whole two-language dictionary for them.
 */
export interface BotLabels {
  launcher: string;
  title: string;
  subtitle: string;
  greeting: string;
  placeholder: string;
  send: string;
  noAnswer: string;
  operatorIntro: string;
  operatorCta: string;
  close: string;
  askHuman: string;
  /** Question and answer per FAQ id (lib/nav/support.ts BOT_FAQ_IDS). */
  faq: Partial<Record<BotFaqId, { q: string; a: string }>>;
}

interface Msg {
  role: "bot" | "user";
  text: string;
  operator?: boolean; // show the WhatsApp handoff button under this message
}

export default function SupportBot({
  labels,
  waUrl,
}: {
  labels: BotLabels;
  waUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  // A field has focus (the phone's keyboard is up): the floating button
  // steps aside so it never sits over what is being typed.
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const greeting = labels.greeting;

  // Opening the panel the first time seeds the greeting.
  const toggle = () => {
    if (!open && msgs.length === 0) setMsgs([{ role: "bot", text: greeting }]);
    setOpen(!open);
  };

  // The account menu's Help → "Support chat" opens the panel from anywhere
  // — also on the form pages where the floating button is hidden.
  useEffect(() => {
    const openFromMenu = () => {
      setMsgs((m) => (m.length === 0 ? [{ role: "bot", text: greeting }] : m));
      setOpen(true);
    };
    window.addEventListener(OPEN_SUPPORT, openFromMenu);
    return () => window.removeEventListener(OPEN_SUPPORT, openFromMenu);
  }, [greeting]);

  useEffect(() => {
    const isField = (el: EventTarget | null) =>
      el instanceof HTMLElement &&
      el.matches("input:not([type=checkbox]):not([type=radio]):not([type=hidden]), textarea, select") &&
      !el.closest(".bot-panel");
    const onIn = (event: FocusEvent) => setTyping(isField(event.target));
    const onOut = () => setTyping(false);
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => {
      document.removeEventListener("focusin", onIn);
      document.removeEventListener("focusout", onOut);
    };
  }, []);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const answerFor = (text: string): Msg => {
    const q = text.toLowerCase();
    const hit = BOT_FAQ.find((f) => f.keywords.some((k) => q.includes(k.toLowerCase())));
    const entry = hit ? labels.faq[hit.id] : undefined;
    if (entry) return { role: "bot", text: entry.a };
    return { role: "bot", text: labels.noAnswer, operator: true };
  };

  const ask = (id: BotFaqId) => {
    const entry = labels.faq[id];
    if (!entry) return;
    setMsgs((m) => [...m, { role: "user", text: entry.q }, { role: "bot", text: entry.a }]);
  };

  const askHuman = () => {
    setMsgs((m) => [
      ...m,
      { role: "user", text: labels.askHuman },
      { role: "bot", text: labels.operatorIntro, operator: true },
    ]);
  };

  // On a form page the floating button is left out (the panel can still be
  // opened from the menu); while typing it hides on phones (CSS).
  const launcherHidden = !open && supportLauncherHidden(pathname);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }, answerFor(text)]);
  };

  return (
    <>
      {!launcherHidden && (
      <button
        type="button"
        className={`bot-launcher${typing && !open ? " bot-launcher--typing" : ""}`}
        aria-label={labels.launcher}
        aria-expanded={open}
        onClick={toggle}
      >
        {open ? (
          <IconClose size={26} />
        ) : (
          <svg
            className="bot-launcher__ico"
            width="30"
            height="30"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            {/* Headset — the universal "support / operator" mark. */}
            <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
            <path d="M4 14h2.5a1 1 0 0 1 1 1v3.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" />
            <path d="M20 14h-2.5a1 1 0 0 0-1 1v3.5a1 1 0 0 0 1 1H19a1 1 0 0 0 1-1z" />
            <path d="M20 19v.5a3 3 0 0 1-3 3h-3" />
          </svg>
        )}
      </button>
      )}

      {open && (
        <div className="bot-panel" role="dialog" aria-label={labels.title}>
          <div className="bot-head">
            <div>
              <div className="bot-head__title">{labels.title}</div>
              <div className="bot-head__sub">{labels.subtitle}</div>
            </div>
            <button
              type="button"
              className="bot-head__close"
              aria-label={labels.close}
              onClick={() => setOpen(false)}
            >
              <IconClose size={20} />
            </button>
          </div>

          <div className="bot-body" ref={scrollRef}>
            {msgs.map((m, i) => (
              <div key={i} className={`bot-msg bot-msg--${m.role}`}>
                <div className="bot-bubble">{m.text}</div>
                {m.operator && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bot-wa"
                  >
                    <IconChat size={16} /> {labels.operatorCta}
                  </a>
                )}
              </div>
            ))}

            {/* Suggested questions — always available so the user can tap. */}
            <div className="bot-chips">
              {BOT_FAQ.map((f) => {
                const entry = labels.faq[f.id];
                return entry ? (
                  <button key={f.id} type="button" className="bot-chip" onClick={() => ask(f.id)}>
                    {entry.q}
                  </button>
                ) : null;
              })}
              <button type="button" className="bot-chip bot-chip--human" onClick={askHuman}>
                {labels.askHuman}
              </button>
            </div>
          </div>

          <form className="bot-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={labels.placeholder}
              aria-label={labels.placeholder}
            />
            <button type="submit" className="btn-primary" disabled={!input.trim()}>
              {labels.send}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
