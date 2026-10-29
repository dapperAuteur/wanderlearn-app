import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// No DOM test environment in this repo (vitest runs in node; Playwright owns the browser), so the
// buttons are rendered to HTML and the markup is read directly. Click ORDER is pinned in
// src/lib/sign-out-flow.test.ts. BAM, 2026-10-29, witus task 128 option (b).

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }));
vi.mock("@/lib/auth-client", () => ({ signOut: async () => {} }));

const { SignOutButton, SignOutEverywhereButton } = await import("./sign-out-button");

const ENDSESSION = "https://accounts.witus.online/api/idp/oauth2/endsession?client_id=wanderlearn";
const HELP =
  "Also signs you out of WitUS. Other WitUS apps you are signed in to stay signed in until you sign out of them.";

function buttonText(html: string): string[] {
  return [...html.matchAll(/<button\b[^>]*>([^<]*)<\/button>/g)].map((m) => m[1]);
}

describe("SignOutButton (\"Sign out\")", () => {
  it('is named exactly "Sign out" and carries no end-session URL', () => {
    const html = renderToStaticMarkup(<SignOutButton label="Sign out" lang="en" />);
    expect(buttonText(html)).toEqual(["Sign out"]);
    expect(html).not.toContain("endsession");
    expect(html).not.toContain("WitUS");
  });
});

describe("SignOutEverywhereButton (\"Sign out of WitUS everywhere\")", () => {
  it("renders nothing when no end-session URL was resolved", () => {
    expect(
      renderToStaticMarkup(
        <SignOutEverywhereButton label="Sign out of WitUS everywhere" help={HELP} endSessionUrl={null} />,
      ),
    ).toBe("");
  });

  it("renders beside Sign out when configured, with help linked by aria-describedby", () => {
    const html = renderToStaticMarkup(
      <>
        <SignOutButton label="Sign out" lang="en" />
        <SignOutEverywhereButton
          label="Sign out of WitUS everywhere"
          help={HELP}
          endSessionUrl={ENDSESSION}
        />
      </>,
    );
    expect(buttonText(html)).toEqual(["Sign out", "Sign out of WitUS everywhere"]);
    const describedBy = html.match(
      /<button\b[^>]*aria-describedby="([^"]+)"[^>]*>Sign out of WitUS everywhere<\/button>/,
    )?.[1];
    expect(describedBy).toBeTruthy();
    const escaped = (describedBy as string).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const help = html.match(new RegExp(`<p\\b[^>]*id="${escaped}"[^>]*>([^<]*)</p>`))?.[1];
    expect(help).toBe(HELP);
  });
});
