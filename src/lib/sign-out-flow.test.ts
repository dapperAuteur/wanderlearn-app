import { describe, expect, it } from "vitest";
import { signOutEverywhere, signOutHere } from "./sign-out-flow";

// BAM, 2026-10-29, witus task 128 option (b): "Sign out" is this app only; "Sign out of WitUS
// everywhere" ends this app's session FIRST and then hands off to the IdP.

const ENDSESSION = "https://accounts.witus.online/api/idp/oauth2/endsession?client_id=wanderlearn";

describe("signOutHere (\"Sign out\")", () => {
  it("ends the local session, then goes to the local destination, never the IdP", async () => {
    const events: string[] = [];
    await signOutHere({
      endLocalSession: async () => {
        events.push("local");
      },
      goLocal: () => events.push("go-local"),
    });
    expect(events).toEqual(["local", "go-local"]);
  });

  it("still goes to the local destination when the local sign-out fails", async () => {
    const events: string[] = [];
    await signOutHere({
      endLocalSession: async () => {
        events.push("local");
        throw new Error("network");
      },
      goLocal: () => events.push("go-local"),
    });
    expect(events).toEqual(["local", "go-local"]);
  });
});

describe("signOutEverywhere (\"Sign out of WitUS everywhere\")", () => {
  it("ends the local session BEFORE navigating to the IdP", async () => {
    const events: string[] = [];
    let release: () => void = () => {};
    const pending = signOutEverywhere({
      endLocalSession: () =>
        new Promise<void>((resolve) => {
          events.push("local-start");
          release = () => {
            events.push("local-done");
            resolve();
          };
        }),
      endSessionUrl: ENDSESSION,
      origin: "https://wanderlust.witus.online",
      assign: (url) => events.push(`assign:${url}`),
    });
    // Nothing navigates while the local sign-out is still in flight.
    await Promise.resolve();
    expect(events).toEqual(["local-start"]);
    release();
    await pending;
    expect(events[1]).toBe("local-done");
    expect(events[2]).toMatch(/^assign:/);
  });

  it("navigates to endsession with client_id and post_logout_redirect_uri = origin + '/'", async () => {
    let to = "";
    await signOutEverywhere({
      endLocalSession: async () => {},
      endSessionUrl: ENDSESSION,
      origin: "https://wanderlust.witus.online",
      assign: (url) => {
        to = url;
      },
    });
    expect(to).toBe(
      `${ENDSESSION}&post_logout_redirect_uri=${encodeURIComponent("https://wanderlust.witus.online/")}`,
    );
    const url = new URL(to);
    expect(url.pathname).toBe("/api/idp/oauth2/endsession");
    expect(url.searchParams.get("client_id")).toBe("wanderlearn");
    expect(url.searchParams.get("post_logout_redirect_uri")).toBe("https://wanderlust.witus.online/");
  });

  it("still hands off to the IdP when the local sign-out errors (awaited, error swallowed)", async () => {
    const events: string[] = [];
    await signOutEverywhere({
      endLocalSession: async () => {
        events.push("local");
        throw new Error("network");
      },
      endSessionUrl: ENDSESSION,
      origin: "https://wanderlust.witus.online",
      assign: () => events.push("assign"),
    });
    expect(events).toEqual(["local", "assign"]);
  });
});
