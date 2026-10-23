/** Normalized AI failures so the UI can show one friendly message per cause. */

export type AiErrorCode =
  | "no_key"
  | "auth"
  | "rate_limited"
  | "network"
  | "refused"
  | "empty"
  | "invalid_json"
  | "bad_request"
  | "cancelled"
  | "upstream";

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    message: string = code,
    /** Partial text streamed before the failure, if any. */
    readonly partial = "",
  ) {
    super(message);
    this.name = "AiError";
  }
}

export function toAiError(err: unknown, partial = ""): AiError {
  if (err instanceof AiError) return err;
  const status = (err as { status?: number } | null)?.status;
  const name = (err as { name?: string } | null)?.name ?? "";
  const message = (err as { message?: string } | null)?.message ?? "";
  if (status === 401 || status === 403) return new AiError("auth", message, partial);
  if (status === 429) return new AiError("rate_limited", message, partial);
  if (status === 400) return new AiError("bad_request", message, partial);
  if (/abort/i.test(name)) return new AiError("cancelled", message, partial);
  if (status === undefined) return new AiError("network", message, partial);
  return new AiError("upstream", message, partial);
}

const MESSAGES: Record<AiErrorCode, string> = {
  no_key: "오늘 탭 맨 아래 '설정'에 Claude API 키를 넣어 주세요.",
  auth: "API 키가 맞지 않거나 결제가 등록되지 않았어요. 설정에서 키를 확인해 주세요.",
  rate_limited: "잠시 너무 많이 썼어요. 조금 뒤에 다시 보내 주세요.",
  network: "인터넷 연결을 확인해 주세요.",
  refused: "AI가 이 내용에는 답하지 않았어요. 다르게 말해 보세요.",
  empty: "답이 비어 있어요. 다시 보내 주세요.",
  invalid_json: "결과를 만들지 못했어요. 다시 눌러 주세요.",
  bad_request: "요청을 처리하지 못했어요. 설정의 AI 모델을 바꿔 보세요.",
  cancelled: "",
  upstream: "답을 받지 못했어요. 다시 보내 주세요.",
};

export function errorMessage(err: unknown): string {
  return MESSAGES[toAiError(err).code];
}
