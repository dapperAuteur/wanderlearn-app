import FormData from "form-data";
import Mailgun from "mailgun.js";
import { env } from "./env";

const defaultFrom = "Wanderlearn <noreply@witus.online>";

type MailgunClient = ReturnType<InstanceType<typeof Mailgun>["client"]>;

let cached: MailgunClient | undefined;

function getClient(): MailgunClient | null {
  const apiKey = env.MAILGUN_API_KEY;
  if (!apiKey) return null;
  if (cached) return cached;
  const mailgun = new Mailgun(FormData);
  cached = mailgun.client({
    username: "api",
    key: apiKey,
    url: env.MAILGUN_REGION === "eu" ? "https://api.eu.mailgun.net" : "https://api.mailgun.net",
  });
  return cached;
}

// Accept the two shapes Mailgun's RFC 5322 parser actually accepts from us:
//   1. bare addr-spec:     noreply@example.com
//   2. display + <addr>:   Name <noreply@example.com>   or   "Name" <noreply@example.com>
// Anything else — empty strings, dangling angle brackets, a whole quoted
// string with no addr — we reject here so the failure surfaces in our logs
// with the actual value instead of Mailgun's opaque "not a valid address".
const fromRegex =
  /^(?:(?:"[^"]+"|[^"<>]+)\s+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>|[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+)$/;

function normalizeFrom(raw: string): string {
  // Vercel env vars preserve literal quotes — a value pasted as
  //   "Name <x@y>"
  // becomes process.env.EMAIL_FROM === '"Name <x@y>"', which Mailgun reads
  // as a quoted-string with no addr-spec. Strip one layer of matching
  // outer quotes so a common paste mistake doesn't page anyone.
  const trimmed = raw.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'") && trimmed.length >= 2)
  ) {
    return trimmed.slice(1, -1).trim();
  }
  return trimmed;
}

function resolveFrom(): string {
  const candidate = env.EMAIL_FROM ? normalizeFrom(env.EMAIL_FROM) : defaultFrom;
  if (!fromRegex.test(candidate)) {
    throw new Error(
      `EMAIL_FROM is not a valid RFC 5322 address: ${JSON.stringify(candidate)}. ` +
        `Expected either "name@domain" or "Display Name <name@domain>" (no outer quotes).`,
    );
  }
  return candidate;
}

export async function sendEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<void> {
  const client = getClient();
  const domain = env.MAILGUN_DOMAIN;
  const from = resolveFrom();

  if (!client || !domain) {
    if (env.NODE_ENV !== "production") {
      console.warn(
        `[mailer:dev-fallback] No MAILGUN_API_KEY or MAILGUN_DOMAIN set. Would have sent:\n` +
          `  from:    ${from}\n` +
          `  to:      ${input.to}\n` +
          `  subject: ${input.subject}\n` +
          `  body:    ${input.text}`,
      );
      return;
    }
    throw new Error(
      "MAILGUN_API_KEY and MAILGUN_DOMAIN are required in production to send email",
    );
  }

  try {
    await client.messages.create(domain, {
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    });
  } catch (err) {
    // Re-throw with the actual from/domain we tried. Mailgun's raw error
    // ("from parameter is not a valid address") doesn't tell you what was
    // sent, and the sender/domain are the two values most likely wrong.
    console.error(
      `[mailer] Mailgun rejected send. from=${JSON.stringify(from)} ` +
        `domain=${JSON.stringify(domain)} to=${JSON.stringify(input.to)}`,
    );
    throw err;
  }
}
