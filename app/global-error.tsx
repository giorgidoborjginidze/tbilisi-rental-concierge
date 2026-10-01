"use client";

// The last fallback: an error in the root layout itself. It replaces the
// whole document, so it brings its own <html>, <body>, title and a few
// inline styles in the Ice colours (globals.css does not reach it). In
// Georgian first, English under it — the locale cookie cannot be read here.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <html lang="ka">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#eef5fa",
          color: "#16354a",
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          padding: 16,
        }}
      >
        <title>შეცდომა · Activo</title>
        <main
          role="alert"
          style={{
            maxWidth: 440,
            width: "100%",
            background: "#ffffff",
            borderRadius: 18,
            padding: 24,
            boxShadow: "0 10px 30px rgba(38, 92, 130, 0.15)",
          }}
        >
          <h1 style={{ margin: "0 0 8px", fontSize: 22 }}>რაღაც არ გამოვიდა</h1>
          <p style={{ margin: "0 0 6px" }}>Activo ვერ ჩაიტვირთა. სცადე თავიდან — შენი მონაცემები ხელუხლებელია.</p>
          <p lang="en" style={{ margin: "0 0 16px", fontSize: 14, color: "#4a6578" }}>
            Activo could not load. Try again — your data is safe.
          </p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              onClick={() => retry()}
              style={{
                minHeight: 44,
                padding: "0 18px",
                borderRadius: 12,
                border: 0,
                background: "#1f6fa8",
                color: "#ffffff",
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              თავიდან ცდა · Try again
            </button>
            {/* A plain link: the app's router may be what failed. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/" style={{ color: "#1f6fa8" }}>
              მთავარი · Home
            </a>
          </div>
          {error.digest && (
            <p style={{ margin: "16px 0 0", fontSize: 12, color: "#4a6578" }}>ref: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
}
