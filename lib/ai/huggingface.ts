import type { Complete } from "./contracts";

const endpoint = "https://router.huggingface.co/v1/chat/completions";

export function createHuggingFaceClient(token: string, model: string): Complete {
  return async (messages, options) => {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: options?.temperature ?? 0.35,
        max_tokens: options?.maxTokens ?? 900,
      }),
      signal: AbortSignal.timeout(55_000),
      cache: "no-store",
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 400);
      throw new Error(`Hugging Face 요청 실패 (${response.status}): ${detail}`);
    }

    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("Hugging Face가 빈 응답을 반환했습니다.");
    return content;
  };
}
