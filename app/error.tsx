"use client";

import Link from "next/link";

// Fallback for an unexpected error in a page — in Georgian first, with the
// English line under it (a client error boundary cannot read the locale
// cookie before it renders, and loading the whole dictionary for this one
// screen would weigh on every page). The error itself is logged on the
// server by instrumentation.ts; the reference below is its digest, so
// support can find that log line.
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <main>
      <section className="auth-box" role="alert">
        <h1>რაღაც არ გამოვიდა</h1>
        <p>გვერდი ვერ ჩაიტვირთა. სცადე თავიდან — შენი მონაცემები ხელუხლებელია.</p>
        <p style={{ color: "var(--color-text-muted)", fontSize: 13 }} lang="en">
          Something went wrong loading this page. Try again — your data is safe.
        </p>
        <div className="flex flex-wrap items-center gap-3" style={{ marginTop: 16 }}>
          <button type="button" className="btn-primary" onClick={() => retry()}>
            თავიდან ცდა · Try again
          </button>
          <Link href="/" className="link">მთავარი · Home</Link>
        </div>
        {error.digest && (
          <p style={{ color: "var(--color-text-muted)", fontSize: 12, marginTop: 16 }}>
            ref: {error.digest}
          </p>
        )}
      </section>
    </main>
  );
}
