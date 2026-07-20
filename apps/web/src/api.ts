const API = "/api";
const englishErrors: Record<string, string> = {
  CORS_ORIGIN_DENIED: "This website origin is not allowed.",
  EMAIL_EXISTS: "This email address is already in use.",
  FORBIDDEN: "You do not have permission to perform this action.",
  GENERATOR_SOURCE_REQUIRED: "Enter a subject or upload a PDF.",
  LOGIN_FAILED: "Email or password is incorrect.",
  NICKNAME_EXISTS: "This nickname is already being used in the room.",
  PDF_TEXT_EMPTY: "No readable text was found in this PDF.",
  PIN_NOT_FOUND: "The PIN does not exist or has expired.",
  PLAYER_TOKEN_INVALID: "Your player session is no longer valid.",
  QUESTION_CLOSED: "This question is no longer accepting answers.",
  QUESTION_TIMEOUT: "The answer time has expired.",
  QUIZ_EMPTY: "Add at least one question before starting.",
  QUIZ_NOT_FOUND: "Quiz not found.",
  RESET_CODE_INVALID: "The reset code is invalid or has expired.",
  SESSION_FULL: "This room is full.",
  SESSION_NOT_FOUND: "Game session not found.",
  SESSION_NOT_JOINABLE: "This game can no longer be joined.",
  SETTINGS_LOCKED: "Room settings cannot be changed after the game starts.",
  UNAUTHORIZED: "Please log in to continue.",
  VALIDATION_ERROR: "Some submitted information is invalid.",
};

function localizedError(payload: any) {
  if (localStorage.getItem("rr_locale") === "en")
    return (
      englishErrors[payload?.code] || "The request could not be completed."
    );
  return payload?.message || "Không thể kết nối hệ thống.";
}

export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;
  constructor(status: number, payload: any) {
    super(localizedError(payload));
    this.code = payload?.code || "REQUEST_FAILED";
    this.status = status;
    this.details = payload?.details;
  }
}
export async function request<T>(
  path: string,
  options: RequestInit & { token?: string } = {},
) {
  const { token, ...init } = options;
  const isForm = init.body instanceof FormData;
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(!isForm ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (!res.ok) {
    let payload;
    try {
      payload = await res.json();
    } catch {
      payload = {
        message:
          localStorage.getItem("rr_locale") === "en"
            ? "The request failed."
            : "Yêu cầu thất bại.",
      };
    }
    throw new ApiError(res.status, payload);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}
export const hostToken = () => localStorage.getItem("rr_host_token") || "";
export const playerToken = (sessionId: string) =>
  sessionStorage.getItem(`rr_player_${sessionId}`) || "";
