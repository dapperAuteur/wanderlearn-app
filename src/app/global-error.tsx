"use client";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1.5rem",
          background: "#0a0a0a",
          color: "#f5f5f5",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
        }}
      >
        <main
          role="alert"
          aria-live="assertive"
          style={{
            maxWidth: "32rem",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          <h1 style={{ fontSize: "1.75rem", fontWeight: 600, lineHeight: 1.2, margin: 0 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "1rem", lineHeight: 1.6, margin: 0 }}>
            Wanderlearn hit an unexpected error. Please try again. If the problem keeps
            happening, note the error reference below and report it to the team.
          </p>
          {error.digest ? (
            <p style={{ fontFamily: "ui-monospace, monospace", fontSize: "0.875rem", margin: 0 }}>
              Reference: {error.digest}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => unstable_retry()}
            style={{
              minHeight: "2.75rem",
              padding: "0 1.25rem",
              borderRadius: "0.375rem",
              border: "1px solid #f5f5f5",
              background: "#f5f5f5",
              color: "#0a0a0a",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
