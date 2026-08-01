const API = "/api";
const vietnameseErrors: Record<string, string> = {
  ACCOUNT_SUSPENDED: "Tài khoản đã bị tạm khóa.",
  ADMIN_REQUIRED: "Bạn cần quyền quản trị viên để thực hiện thao tác này.",
  ADMIN_SELF_PROTECTED:
    "Bạn không thể thay đổi quyền hoặc mật khẩu quản trị của chính mình tại đây.",
  BACKUP_BUSY: "Một thao tác sao lưu hoặc phục hồi khác đang được thực hiện.",
  BACKUP_CHECKSUM_INVALID: "Bản sao không còn nguyên vẹn hoặc đã bị thay đổi.",
  BACKUP_CORRUPTED: "Bản sao bị lỗi hoặc không đúng định dạng.",
  BACKUP_ID_INVALID: "Mã bản sao lưu không hợp lệ.",
  BACKUP_NAMESPACE_MISMATCH: "Bản sao này không thuộc dữ liệu của ứng dụng.",
  BACKUP_NOT_FOUND: "Không tìm thấy bản sao lưu.",
  BACKUP_RESTORE_FAILED:
    "Phục hồi thất bại; dữ liệu ban đầu đã được tự động khôi phục.",
  BACKUP_ROLLBACK_FAILED:
    "Phục hồi và hoàn tác đều thất bại. Hãy dùng bản sao an toàn.",
  BACKUP_TOO_LARGE: "Dữ liệu hiện tại vượt quá giới hạn sao lưu.",
  CURRENT_PASSWORD_INVALID: "Mật khẩu hiện tại không đúng.",
  EMAIL_EXISTS: "Địa chỉ email đã được sử dụng.",
  EMAIL_CODE_INVALID: "Mã xác nhận email không đúng hoặc đã hết hạn.",
  EMAIL_CODE_RATE_LIMITED: "Vui lòng chờ trước khi yêu cầu gửi lại mã.",
  EMAIL_NOT_CONFIGURED: "Chưa cấu hình SMTP để gửi mã xác nhận qua email.",
  EMAIL_SEND_FAILED:
    "Không thể gửi email xác nhận. Vui lòng kiểm tra cấu hình SMTP.",
  FORBIDDEN: "Bạn không có quyền thực hiện thao tác này.",
  LAST_ADMIN_PROTECTED:
    "Hệ thống phải còn ít nhất một quản trị viên đang hoạt động.",
  LOGIN_FAILED: "Tên đăng nhập/email hoặc mật khẩu không đúng.",
  LOGIN_RATE_LIMITED:
    "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau.",
  RESET_CODE_INVALID: "Mã đặt lại mật khẩu không đúng hoặc đã hết hạn.",
  UNAUTHORIZED: "Vui lòng đăng nhập để tiếp tục.",
  USERNAME_EXISTS: "Tên đăng nhập đã được sử dụng.",
  VALIDATION_ERROR: "Thông tin nhập vào chưa hợp lệ. Vui lòng kiểm tra lại.",
};

const englishErrors: Record<string, string> = {
  ACCOUNT_SUSPENDED: "This account has been suspended.",
  ADMIN_REQUIRED: "Administrator access is required.",
  ADMIN_SELF_PROTECTED:
    "You cannot change your own administrator account here.",
  AVATAR_INVALID: "The avatar image format is invalid.",
  AVATAR_TOO_LARGE: "The avatar image is too large. Choose another image.",
  BACKUP_BUSY: "Another backup or restore operation is already running.",
  BACKUP_CHECKSUM_INVALID:
    "The backup checksum is invalid. The file may have been modified.",
  BACKUP_CORRUPTED: "The backup file is corrupted or has an invalid format.",
  BACKUP_ID_INVALID: "The backup identifier is invalid.",
  BACKUP_NAMESPACE_MISMATCH:
    "This backup belongs to a different Redis namespace.",
  BACKUP_NOT_FOUND: "Backup not found.",
  BACKUP_RESTORE_FAILED:
    "Restore failed. The original data was rolled back automatically.",
  BACKUP_ROLLBACK_FAILED:
    "Restore and automatic rollback both failed. Use the safety backup.",
  BACKUP_TOO_LARGE: "The Redis namespace is too large to back up.",
  CORS_ORIGIN_DENIED: "This website origin is not allowed.",
  CURRENT_PASSWORD_INVALID: "Your current password is incorrect.",
  EMAIL_EXISTS: "This email address is already in use.",
  EMAIL_CODE_INVALID: "The email verification code is invalid or has expired.",
  EMAIL_CODE_RATE_LIMITED:
    "Please wait 60 seconds before requesting another code.",
  EMAIL_NOT_CONFIGURED:
    "SMTP is not configured, so the verification code cannot be emailed.",
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
  const mapped = vietnameseErrors[payload?.code];
  if (mapped) return mapped;
  const message = String(payload?.message || "");
  const corrupted = /(?:Ã|Ä|Æ|Â|á»|áº)/.test(message);
  return message && !corrupted
    ? message
    : "Yêu cầu không thể thực hiện. Vui lòng thử lại.";
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
