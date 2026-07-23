const API = "/api";
const englishErrors: Record<string, string> = {
  ACCOUNT_SUSPENDED: "This account has been suspended.",
  ADMIN_REQUIRED: "Administrator access is required.",
  ADMIN_SELF_PROTECTED:
    "You cannot change your own administrator account here.",
  CORS_ORIGIN_DENIED: "This website origin is not allowed.",
  CURRENT_PASSWORD_INVALID: "Your current password is incorrect.",
  EMAIL_EXISTS: "This email address is already in use.",
  EMAIL_CODE_INVALID: "The email verification code is invalid or has expired.",
  EMAIL_CODE_RATE_LIMITED:
    "Please wait 60 seconds before requesting another code.",
  EMAIL_SEND_FAILED:
    "The verification email could not be sent. Check the SMTP configuration.",
  FORBIDDEN: "You do not have permission to perform this action.",
  GENERATOR_SOURCE_REQUIRED: "Enter a subject or upload a PDF/CSV file.",
  AI_DOCUMENT_UNAVAILABLE:
    "The AI service is not ready to read this PDF. Start local AI or upload the CSV template.",
  AI_GENERATOR_UNAVAILABLE:
    "The AI service is not ready. Start local AI or import questions from CSV.",
  CSV_EMPTY: "The CSV file does not contain any questions.",
  CSV_INVALID:
    "The CSV file is invalid. Download and use the provided template.",
  CSV_TOO_LARGE: "A CSV file can contain at most 100 questions.",
  HOST_CANNOT_JOIN_OWN_SESSION:
    "The Host controls this room and cannot join it as a player.",
  LOGIN_FAILED: "Username/email or password is incorrect.",
  LOGIN_RATE_LIMITED:
    "Too many failed login attempts. Try again in 15 minutes.",
  LAST_ADMIN_PROTECTED:
    "The last active administrator cannot be demoted or suspended.",
  NICKNAME_EXISTS: "This nickname is already being used in the room.",
  PDF_TEXT_EMPTY: "No readable text was found in this PDF.",
  PIN_NOT_FOUND: "The PIN does not exist or has expired.",
  PLAYER_TOKEN_INVALID: "Your player session is no longer valid.",
  QUESTION_CLOSED: "This question is no longer accepting answers.",
  QUESTION_TIMEOUT: "The answer time has expired.",
  QUIZ_EMPTY: "Add at least one question before starting.",
  QUIZ_INVALID:
    "Review the quiz and correct invalid questions before publishing.",
  QUIZ_NOT_FOUND: "Quiz not found.",
  RESET_CODE_INVALID: "The reset code is invalid or has expired.",
  SESSION_FULL: "This room is full.",
  SESSION_EMPTY: "At least one player is required to start.",
  SESSION_ENDED: "This game session has already ended.",
  SESSION_NOT_FOUND: "Game session not found.",
  SESSION_NOT_JOINABLE: "This game can no longer be joined.",
  SESSION_NOT_CANCELLABLE: "Only a lobby can be cancelled.",
  SESSION_NOT_REPLAYABLE: "Only a completed game can be played again.",
  SETTINGS_LOCKED: "Room settings cannot be changed after the game starts.",
  UNAUTHORIZED: "Please log in to continue.",
  UNSAFE_NICKNAME:
    "This nickname contains inappropriate content. Choose another name.",
  USERNAME_EXISTS: "This username is already in use.",
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
