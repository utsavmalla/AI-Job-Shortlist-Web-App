import { afterEach, describe, expect, it, vi } from "vitest";
import { assertPublicUrl, extractTextFromUrl } from "@/lib/url-content";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.EXTERNAL_REQUEST_DEBUG;
});

describe("URL safety", () => {
  it.each(["http://localhost/jobs/1", "http://127.0.0.1/job", "http://10.0.0.4/job", "http://192.168.1.5/job", "file:///etc/passwd"])("rejects private or unsupported target %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects credentials in URLs", async () => {
    await expect(assertPublicUrl("https://user:pass@example.com/job")).rejects.toMatchObject({ code: "INVALID_URL" });
  });

  it("logs public page fetches with sanitized debug metadata", async () => {
    process.env.EXTERNAL_REQUEST_DEBUG = "true";
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("<main>We need a React engineer with TypeScript experience. This job description has enough readable content for extraction and mentions frontend accessibility work.</main>", {
      headers: { "content-type": "text/html; charset=utf-8", "content-length": "150" },
    })));

    await expect(extractTextFromUrl("https://93.184.216.34/jobs/engineer?key=secret")).resolves.toMatchObject({
      sourceUrl: "https://93.184.216.34/jobs/engineer?key=secret",
    });

    expect(info).toHaveBeenCalledWith(
      "External request started: Job URL page fetch GET https://93.184.216.34/jobs/engineer",
      expect.objectContaining({ url: "https://93.184.216.34/jobs/engineer", redirectCount: 0 }),
    );
    expect(info).toHaveBeenCalledWith(
      "External request completed: Job URL page fetch GET https://93.184.216.34/jobs/engineer",
      expect.objectContaining({ status: 200, contentType: "text/html; charset=utf-8", contentLength: "150" }),
    );
    expect(JSON.stringify(info.mock.calls)).not.toContain("secret");
  });
});
