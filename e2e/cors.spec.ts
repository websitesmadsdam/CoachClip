import { test, expect } from "@playwright/test";

test.describe("CoachClip - CORS Policy Checks", () => {
  test("should allow configured canonical origin in preflight OPTIONS request", async ({ request }) => {
    const response = await request.fetch("/api/exports", {
      method: "OPTIONS",
      headers: {
        Origin: "http://127.0.0.1:3001",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.status()).toBe(204);
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBe("http://127.0.0.1:3001");
    expect(headers["access-control-allow-origin"]).not.toBe("*");
  });

  test("should NOT return permitting CORS headers for unauthorized origin", async ({ request }) => {
    const response = await request.fetch("/api/exports", {
      method: "OPTIONS",
      headers: {
        Origin: "http://localhost:9999",
        "Access-Control-Request-Method": "POST",
      },
    });

    expect(response.status()).toBe(204);
    const headers = response.headers();
    expect(headers["access-control-allow-origin"]).toBeUndefined();
  });
});
