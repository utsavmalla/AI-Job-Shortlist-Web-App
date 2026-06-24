import { describe, expect, it } from "vitest";
import { assertPublicUrl } from "@/lib/url-content";

describe("URL safety", () => {
  it.each(["http://localhost/jobs/1", "http://127.0.0.1/job", "http://10.0.0.4/job", "http://192.168.1.5/job", "file:///etc/passwd"])("rejects private or unsupported target %s", async (url) => {
    await expect(assertPublicUrl(url)).rejects.toMatchObject({ status: 400 });
  });

  it("rejects credentials in URLs", async () => {
    await expect(assertPublicUrl("https://user:pass@example.com/job")).rejects.toMatchObject({ code: "INVALID_URL" });
  });
});
