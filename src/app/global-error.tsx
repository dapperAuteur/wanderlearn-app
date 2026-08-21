"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  // The root boundary is the one place an error can reach with no other reporter left in the tree,
  // so report it explicitly. A no-op when no DSN is configured. Keyed on the error so a retry that
  // fails a second time is reported a second time rather than swallowed.
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

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
            Wanderlust hit an unexpected error. Please try again. If the problem keeps
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
