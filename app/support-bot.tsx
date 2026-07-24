"use client";

import { useEffect, useRef, useState } from "react";
import { t, type Locale, type StringKey } from "@/lib/i18n/strings";

// FAQ the bot can answer on its own. Each entry maps to bot_q_<id> / bot_a_<id>
// strings and carries keywords (both languages) for free-text matching.
const FAQ: { id: string; keywords: string[] }[] = [
  { id: "what", keywords: ["what is", "about", "activo", "რა არის", "შესახებ", "პლატფორმ"] },
  { id: "pricing", keywords: ["price", "cost", "how much", "fee", "plan", "subscription", "free month", "ფას", "ღირ", "თვე", "პაკეტ", "გადასახად", "ფასი"] },
  { id: "sync", keywords: ["sync", "calendar", "airbnb", "booking", "ical", "double", "სინქრ", "კალენდ", "ჯავშ"] },
  { id: "payment", keywords: ["pay", "payment", "card", "apple pay", "google pay", "checkout", "გადახდ", "ბარათ", "გადავიხად"] },
  { id: "security", keywords: ["safe", "secure", "security", "privacy", "data", "დაცვ", "უსაფრთხ", "მონაცემ", "დაცული"] },
  { id: "calc", keywords: ["calculator", "invest", "yield", "კალკულ", "საინვესტ", "მოგება"] },
];

interface Msg {
  role: "bot" | "user";
  text: string;
  operator?: boolean; // show the WhatsApp handoff button under this message
}

export default function SupportBot({
  locale,
  waUrl,
}: {
  locale: Locale;
  waUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const tr = (key: StringKey) => t(locale, key);

  // Seed the greeting the first time the panel opens.
  useEffect(() => {
    if (open && msgs.length === 0) {
      setMsgs([{ role: "bot", text: tr("bot_greeting") }]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Keep the newest message in view.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, open]);

  const answerFor = (text: string): Msg => {
    const q = text.toLowerCase();
    const hit = FAQ.find((f) => f.keywords.some((k) => q.includes(k.toLowerCase())));
    if (hit) {
      return { role: "bot", text: t(locale, `bot_a_${hit.id}` as StringKey) };
    }
    return { role: "bot", text: tr("bot_no_answer"), operator: true };
  };

  const ask = (id: string) => {
    const question = t(locale, `bot_q_${id}` as StringKey);
    setMsgs((m) => [
      ...m,
      { role: "user", text: question },
      { role: "bot", text: t(locale, `bot_a_${id}` as StringKey) },
    ]);
  };

  const askHuman = () => {
    setMsgs((m) => [
      ...m,
      { role: "user", text: tr("bot_q_human") },
      { role: "bot", text: tr("bot_operator_intro"), operator: true },
    ]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text }, answerFor(text)]);
  };

  return (
    <>
      <button
        type="button"
        className="bot-launcher"
        aria-label={tr("bot_launcher")}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? (
          <span aria-hidden style={{ fontSize: 30, lineHeight: 1 }}>×</span>
        ) : (
          <svg
            width="34"
            height="34"
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

      {open && (
        <div className="bot-panel" role="dialog" aria-label={tr("bot_title")}>
          <div className="bot-head">
            <div>
              <div className="bot-head__title">{tr("bot_title")}</div>
              <div className="bot-head__sub">{tr("bot_subtitle")}</div>
            </div>
            <button
              type="button"
              className="bot-head__close"
              aria-label={tr("bot_close")}
              onClick={() => setOpen(false)}
            >
              ×
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
                    💬 {tr("bot_operator_cta")}
                  </a>
                )}
              </div>
            ))}

            {/* Suggested questions — always available so the user can tap. */}
            <div className="bot-chips">
              {FAQ.map((f) => (
                <button key={f.id} type="button" className="bot-chip" onClick={() => ask(f.id)}>
                  {t(locale, `bot_q_${f.id}` as StringKey)}
                </button>
              ))}
              <button type="button" className="bot-chip bot-chip--human" onClick={askHuman}>
                {tr("bot_q_human")}
              </button>
            </div>
          </div>

          <form className="bot-input" onSubmit={submit}>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={tr("bot_placeholder")}
              aria-label={tr("bot_placeholder")}
            />
            <button type="submit" className="btn-primary" disabled={!input.trim()}>
              {tr("bot_send")}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
