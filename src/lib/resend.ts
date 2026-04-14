import { Resend } from "resend";
import { env } from "./env";

const defaultFrom = "Wanderlearn <noreply@wanderlearn.dev>";

let cached: Resend | undefined;

function getClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  cached ??= new Resend(process.env.RESEND_API_KEY);
  return cached;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const client = getClient();
  if (!client) {
    if (env.NODE_ENV !== "production") {
      console.warn(
        `[resend:dev-fallback] No RESEND_API_KEY set. Would have sent:\n` +
          `  to:      ${input.to}\n` +
          `  subject: ${input.subject}\n` +
          `  body:    ${input.text}`,
      );
      return;
    }
    throw new Error("RESEND_API_KEY is required in production to send email");
  }

  await client.emails.send({
    from: process.env.EMAIL_FROM ?? defaultFrom,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
