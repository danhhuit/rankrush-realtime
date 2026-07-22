import nodemailer from "nodemailer";
import { config } from "./config.js";

export const isSmtpConfigured = () =>
  Boolean(config.SMTP_HOST && config.SMTP_USER && config.SMTP_PASS);

const transporter = isSmtpConfigured()
  ? nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth: { user: config.SMTP_USER, pass: config.SMTP_PASS },
      requireTLS: !config.SMTP_SECURE,
      connectionTimeout: 12_000,
      greetingTimeout: 12_000,
      socketTimeout: 20_000,
      disableFileAccess: true,
      disableUrlAccess: true,
    })
  : null;

export async function verifyMailConnection() {
  if (!transporter) return false;
  await transporter.verify();
  return true;
}

export async function sendVerificationCode(
  to: string,
  code: string,
  purpose: "register" | "reset",
) {
  if (!transporter) return false;
  const title =
    purpose === "register"
      ? "Xác nhận tài khoản RankRush"
      : "Đặt lại mật khẩu RankRush";
  const action =
    purpose === "register" ? "hoàn tất đăng ký tài khoản" : "đặt lại mật khẩu";
  try {
    await transporter.sendMail({
      from: config.SMTP_FROM,
      to,
      subject: `${code} — ${title}`,
      text: `Mã xác nhận RankRush của bạn là ${code}. Dùng mã này để ${action}. Mã hết hạn sau ${Math.round((purpose === "register" ? config.EMAIL_CODE_TTL_SECONDS : config.RESET_CODE_TTL_SECONDS) / 60)} phút. Không chia sẻ mã này với người khác.`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#18333d"><h2 style="color:#218fac">RankRush</h2><p>Dùng mã sau để ${action}:</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;background:#e8f7fb;border:1px solid #bfe4ed;border-radius:12px;padding:18px;text-align:center">${code}</div><p style="color:#5d7580">Mã chỉ dùng một lần và sẽ hết hạn. Không chia sẻ mã này với người khác.</p></div>`,
    });
    return true;
  } catch (error) {
    console.error("[email] Không thể gửi mã xác nhận:", error);
    throw Object.assign(
      new Error("Không thể gửi email xác nhận. Hãy kiểm tra cấu hình SMTP."),
      {
        status: 502,
        code: "EMAIL_SEND_FAILED",
      },
    );
  }
}
