import { describe, it, expect, vi } from "vitest";
import { callGemini, GeminiError } from "../src/lib/gemini-client.js";

function makeOkResponse(text) {
  return {
    ok: true,
    json: async () => ({
      candidates: [{ content: { parts: [{ text }] } }],
    }),
  };
}

function makeRateLimitedResponse() {
  return { ok: false, status: 429, headers: { get: () => null } };
}

describe("callGemini", () => {
  it("APIキーが無い場合はGeminiErrorを投げる", async () => {
    await expect(callGemini("prompt", { apiKey: undefined })).rejects.toThrow(GeminiError);
  });

  it("正常応答時はテキストをそのまま返す", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeOkResponse("こんにちは"));

    const result = await callGemini("prompt", { apiKey: "dummy-key", fetchImpl });

    expect(result).toBe("こんにちは");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("429が数回続いた後に成功すれば、リトライして最終的に成功する", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(makeRateLimitedResponse())
      .mockResolvedValueOnce(makeRateLimitedResponse())
      .mockResolvedValueOnce(makeOkResponse("リトライ後の応答"));

    const result = await callGemini("prompt", {
      apiKey: "dummy-key",
      fetchImpl,
      maxRetries: 2,
      retryDelayMs: 1, // テストを高速化するため待機時間を最小化
    });

    expect(result).toBe("リトライ後の応答");
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("429がmaxRetries回を超えて続く場合はGeminiErrorを投げる", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(makeRateLimitedResponse());

    await expect(
      callGemini("prompt", { apiKey: "dummy-key", fetchImpl, maxRetries: 1, retryDelayMs: 1 }),
    ).rejects.toThrow(/429/);
    expect(fetchImpl).toHaveBeenCalledTimes(2); // 初回 + リトライ1回
  });

  it("429以外のHTTPエラーはリトライせず即座にGeminiErrorを投げる", async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 500 });

    await expect(
      callGemini("prompt", { apiKey: "dummy-key", fetchImpl, maxRetries: 2, retryDelayMs: 1 }),
    ).rejects.toThrow(/500/);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
