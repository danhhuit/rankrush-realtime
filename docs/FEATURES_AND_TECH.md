# Phạm vi chức năng và công nghệ RankRush

Tài liệu này mô tả trạng thái đã triển khai của RankRush Realtime. Hệ thống tham
khảo các mẫu tương tác quen thuộc của quiz trực tiếp nhưng dùng thương hiệu,
giao diện, dữ liệu và mã nguồn độc lập.

## 1. Vai trò và chức năng

### 1.1. Khách và người chơi

1. Tìm quiz công khai theo từ khóa, lĩnh vực và nhánh nội dung.
2. Nhập PIN 6 số ở navbar hoặc trang Join; có thể mở trực tiếp đường dẫn từ QR.
3. Tham gia không cần tài khoản bằng biệt danh và avatar tùy biến.
4. Nút xúc xắc chọn ngẫu nhiên từ khoảng 200 tổ hợp tên thân thiện; tên tự nhập
   hợp lệ được giữ nguyên.
5. Bộ lọc biệt danh chạy bắt buộc tại API, không phụ thuộc thiết lập phòng.
6. Vào lobby, xem số người tham gia và chờ Host bắt đầu.
7. Nhận đầy đủ các pha đếm ngược, xem trước câu hỏi, trả lời, kết quả câu và bảng
   xếp hạng qua Socket.IO.
8. Chọn đáp án là gửi ngay; không có bước xác nhận và không thể gửi lần hai.
9. Xem điểm cá nhân, Top 10, bục chiến thắng và thống kê cuối trận.
10. Chọn một trong 15 bản nhạc nền Web Audio, tạm dừng và chỉnh âm lượng.
11. Chuyển sáng/tối và Việt/Anh; lựa chọn được lưu ở trình duyệt.
12. Cảnh báo khi chuyển route, reload, đóng tab hoặc rời website trong lúc phòng
    còn hoạt động.
13. Mỗi tab giữ token và metadata player trong `sessionStorage`; hai tab không
    dùng chung lựa chọn đáp án.

### 1.2. Host

1. Đăng ký bằng tên hiển thị, username, email, mật khẩu, xác nhận mật khẩu và mã
   email 6 số.
2. Đăng nhập bằng username hoặc email; giới hạn số lần đăng nhập sai.
3. Quên mật khẩu qua mã email dùng một lần, mật khẩu mới và xác nhận mật khẩu.
4. Dashboard tổng quan, Quiz của tôi, Thư viện, Báo cáo, Bảng xếp hạng và Cài đặt.
5. CRUD quiz/câu hỏi; hỗ trợ nháp/công khai, nhân bản, sắp thứ tự và tìm kiếm.
6. Câu hỏi một lựa chọn, nhiều lựa chọn, đúng/sai, văn bản, sắp xếp, khoảng số
   và slide thông tin.
7. Tạo phòng từ quiz đã xuất bản; PIN được giữ duy nhất bằng Redis `SET NX EX`.
8. QR dùng địa chỉ LAN hoặc `PUBLIC_WEB_URL`; Host có thể ẩn PIN, QR và link.
9. Lobby hiển thị avatar, nickname và số người realtime; Host có thể loại người
   chơi trước khi bắt đầu.
   Tài khoản sở hữu phòng chỉ mở Host Console, không được tạo Player trong chính
   phòng đó, không tăng `playerCount` và không xuất hiện trên leaderboard/report.
10. Thiết lập Team mode, ẩn leaderboard, tắt âm thiết bị và điểm theo tốc độ.
11. Điều khiển bắt đầu, tạm dừng, tiếp tục, bỏ qua câu, kết thúc, hủy và chơi lại.
12. Xem tiến độ trả lời của phòng mà không nhìn thấy đáp án riêng của Player.
13. Xem báo cáo, bảng xếp hạng theo phiên và xuất CSV.
14. Hộp thoại Có/Không thay cho `window.confirm()` ở mọi thao tác nguy hiểm.
15. Cảnh báo rời trang khi Host còn quản lý một phòng đang hoạt động.

### 1.3. Tạo quiz tự động

1. Nhận chủ đề, PDF có văn bản hoặc CSV theo mẫu; tệp tối đa 10 MB.
2. Host chọn tên quiz, danh mục, số lượng 3–15 câu và nhập mô tả/yêu cầu chi tiết.
3. Backend trích xuất PDF, lập blueprint đa dạng dạng câu/mức nhận thức và yêu
   cầu Gemini trả output theo JSON Schema.
4. Zod kiểm tra cấu trúc; reviewer độc lập chấm căn cứ nguồn, đáp án, độ rõ ràng
   và phương án nhiễu. Câu dưới ngưỡng hoặc gần trùng được tạo lại một lượt.
5. Provider fallback theo thứ tự Gemini → Ollama → generator local. Host vẫn có
   thể tải mẫu và nhập CSV không cần AI.
6. CSV hỗ trợ `SINGLE_CHOICE`, `TRUE_FALSE`, `TEXT`; backend kiểm tra từng dòng,
   đáp án A–F/nội dung đúng, accepted answers và giới hạn tối đa 100 câu.
7. Quiz tự động luôn được lưu dạng nháp và mở trong Quiz Editor để rà soát.
8. Model chính là `gemini-3.6-flash`; Ollama `qwen2.5:3b` là dự phòng cục bộ.
9. `GET /api/ai/status` phục vụ kiểm tra nội bộ; `GET /api/ai/csv-template` tải
   tệp mẫu CSV.

## 2. State machine của phòng chơi

```text
LOBBY
  │ Host bấm Bắt đầu
  ▼
GAME_COUNTDOWN (3 → 2 → 1 → Bắt đầu, tổng 4 giây)
  ▼
QUESTION_PREVIEW (5 giây, câu hỏi và đáp án xuất hiện lần lượt)
  ▼
RUNNING (timer riêng của câu hỏi, mặc định thường là 20 giây)
  ▼
QUESTION_RESULT (5 giây, kết quả câu và leaderboard)
  ├─ còn câu ───────────────► QUESTION_PREVIEW
  └─ hết câu ───────────────► ENDED

Từ QUESTION_PREVIEW/RUNNING/QUESTION_RESULT:
  PAUSED ── tiếp tục ──► quay lại đúng pha và thời gian còn lại
```

Backend sở hữu timer và lịch chuyển pha. Host không phải bấm nút để công bố đáp
án. Khi tất cả người chơi đã trả lời, backend có thể kết thúc pha trả lời sớm;
người không trả lời khi hết giờ nhận 0 điểm.

Các chuyển pha dùng phase lock trong Redis để tránh hai timer hoặc hai request
Host cùng chuyển trạng thái. Khi API khởi động lại hoặc client reconnect, REST
snapshot và timestamp trong Redis phục hồi trạng thái quan sát được.

## 3. Cách tính điểm

Điểm chỉ do backend tính:

```text
sai hoặc không trả lời: 0
đúng: max(100, 1000 - floor(tỉ_lệ_thời_gian × 10) × 100)
câu cuối: điểm đúng × 2
```

- Trả lời đúng gần như ngay lập tức: 1000 điểm.
- Điểm giảm theo các bậc 100 khi thời gian trôi qua.
- Điểm sàn của một đáp án đúng trong thời hạn: 100.
- Câu cuối có thể đạt tối đa 2000 điểm để tăng kịch tính.
- `responseMs` được tính lại theo đồng hồ server; giá trị client chỉ mang tính
  thông tin và không quyết định điểm.
- Lua idempotency bảo đảm retry không cộng điểm lần hai.

## 4. Bảng xếp hạng thời gian thực

Redis Sorted Set là nguồn sự thật:

- `ZADD`: thêm Player với điểm ban đầu bằng 0.
- `ZINCRBY`: cộng điểm nguyên tử sau đáp án đầu tiên hợp lệ.
- `ZREVRANGE ... WITHSCORES`: lấy Top N theo đúng thứ tự Redis.
- `ZREVRANK`: lấy hạng cá nhân.
- Team leaderboard dùng ZSET riêng khi Team mode bật.

Frontend không tải toàn bộ điểm để tự `sort()`. Socket.IO chỉ thông báo thay đổi;
REST snapshot là cơ chế đồng bộ lại sau mất kết nối.

## 5. Kiến trúc

```text
React SPA
├─ Public library / Auth / Settings
├─ Quiz Editor / AI Creator / Reports
├─ Host Console
└─ Player Game
        │ REST + Socket.IO
        ▼
Express API
├─ Zod validation
├─ Host JWT / Player JWT / ownership guards
├─ Game state machine + timers + phase locks
├─ AI/PDF generator + validated CSV import
├─ SMTP email verification
└─ Multilingual nickname moderation
        │
        ▼
Redis 7.4
├─ HASH: User, Quiz, Question, Session, Player, Answer
├─ SET: chỉ mục, thành viên phòng, answer keys
├─ LIST: thứ tự câu hỏi
├─ STRING + TTL: PIN, OTP, cooldown, rate limit, phase lock
├─ ZSET: Player/Team leaderboard
└─ STREAM: sự kiện join/answer phục vụ audit và analytics
```

## 6. Vì sao chọn công nghệ

| Công nghệ          | Vai trò       | Lý do                                                         |
| ------------------ | ------------- | ------------------------------------------------------------- |
| React + TypeScript | SPA           | Component tái sử dụng, type safety, cập nhật realtime rõ ràng |
| React Router 7     | Điều hướng    | Data Router hỗ trợ chặn rời route trong phòng đang hoạt động  |
| Vite               | Dev/build web | Khởi động và build nhanh, cấu hình gọn                        |
| Express            | REST API      | Dễ trình bày, middleware phong phú, phù hợp đồ án             |
| Socket.IO          | Realtime      | Room, reconnect, event và fallback tốt                        |
| Redis + ioredis    | CSDL chính    | ZSET, TTL, transaction, pipeline và Lua độ trễ thấp           |
| Zod                | Validation    | Schema đọc được, dùng chung cho runtime và kiểm thử           |
| JWT + bcrypt       | Xác thực      | Tách Host/Player, mật khẩu không lưu plaintext                |
| Nodemailer         | Email         | Hỗ trợ SMTP Gmail, Outlook, Mailgun, Brevo và provider khác   |
| Multer + pdf-parse | PDF/CSV       | Giới hạn upload, trích văn bản và kiểm tra tệp ở backend      |
| Gemini + Ollama    | Sinh quiz AI  | Structured output, reviewer chất lượng và fallback cục bộ     |
| JSON Schema + Zod  | Output AI     | Giảm lỗi cấu trúc và chặn quiz không hợp lệ                   |
| @2toad/profanity   | Moderation    | Từ điển đa ngôn ngữ và Unicode word boundaries                |
| Vitest + Supertest | Test          | Test nhanh cho hàm, API và lỗi hồi quy                        |
| Docker Compose     | Môi trường    | Redis/RedisInsight đồng nhất giữa các máy                     |

## 7. API chính

| Nhóm     | Endpoint                                               | Mục đích                        |
| -------- | ------------------------------------------------------ | ------------------------------- |
| Health   | `GET /api/health`                                      | Kiểm tra API và Redis           |
| Network  | `GET /api/meta/network`                                | Chọn URL LAN/public cho QR      |
| Email    | `POST /api/auth/email-verification/request`            | Gửi mã đăng ký                  |
| Auth     | `POST /api/auth/register`                              | Tạo Host sau khi xác minh email |
| Auth     | `POST /api/auth/login`                                 | Đăng nhập username hoặc email   |
| Password | `POST /api/auth/forgot-password`                       | Gửi mã đặt lại mật khẩu         |
| Password | `POST /api/auth/reset-password`                        | Xác minh mã và đổi mật khẩu     |
| Profile  | `GET/PUT /api/auth/me`                                 | Đọc/cập nhật tài khoản          |
| Quiz     | `GET/POST /api/quizzes`                                | Danh sách và tạo quiz           |
| Quiz     | `GET/PUT/DELETE /api/quizzes/:id`                      | Chi tiết và CRUD quiz           |
| Question | `POST /api/quizzes/:id/questions`                      | Thêm câu hỏi                    |
| Question | `PUT/DELETE /api/questions/:id`                        | Sửa/xóa câu hỏi                 |
| AI       | `GET /api/ai/status`                                   | Kiểm tra bộ sinh AI             |
| Import   | `GET /api/ai/csv-template`                             | Tải mẫu nhập câu hỏi CSV        |
| AI       | `POST /api/ai/generate-quiz`                           | Tạo/nhập từ chủ đề/PDF/CSV      |
| Session  | `POST /api/sessions`                                   | Tạo phòng và PIN                |
| Session  | `GET /api/sessions/:id`                                | Snapshot theo quyền Host/Player |
| Join     | `GET /api/sessions/pin/:pin`                           | Tra cứu phòng công khai         |
| Join     | `POST /api/sessions/join`                              | Tạo Player và player JWT        |
| Settings | `PATCH /api/sessions/:id/settings`                     | Chốt thiết lập lobby            |
| Host     | `POST .../start`, `.../pause`, `.../resume`            | Điều khiển state machine        |
| Host     | `POST .../skip`, `.../end`, `.../cancel`, `.../replay` | Quản lý vòng đời phòng          |
| Answer   | `POST /api/sessions/:id/answers`                       | Gửi đáp án một lần              |
| Result   | `GET .../leaderboard`, `.../result`, `.../report`      | Hạng và báo cáo                 |

## 8. Xác thực email và tài khoản

- Username và email có chỉ mục Redis riêng, không được trùng.
- Login tự chọn tra cứu username hoặc email theo định dạng identifier.
- Mật khẩu được băm bằng bcrypt.
- Mã email 6 số được băm SHA-256 cùng purpose/email/JWT secret trước khi lưu.
- Cooldown gửi lại là 60 giây.
- Mã đăng ký và mã reset có TTL cấu hình riêng.
- Sau 5 lần nhập mã sai, mã bị hủy.
- Forgot-password trả thông báo giống nhau dù email tồn tại hay không để hạn chế
  dò tài khoản.
- SMTP dùng một tài khoản gửi cấu hình bởi `SMTP_USER`/`SMTP_PASS`; địa chỉ nhận
  luôn lấy động từ email đăng ký hoặc email quên mật khẩu. App Password không
  được sinh theo người nhận và không được commit vào Git.
- Mã xác nhận được gửi trực tiếp qua SMTP. Đặt
  `EMAIL_DEV_CODE_ENABLED=false` và không hiển thị mã thử trên giao diện.

## 9. Kiểm duyệt biệt danh

- Chạy ở backend trước khi ghi Player, vì client-side validation có thể bị bỏ qua.
- Áp dụng cho mọi phòng, kể cả dữ liệu phòng cũ có `safeNames=false`.
- Hỗ trợ Arabic, Chinese, English, French, German, Hindi, Italian, Japanese,
  Korean, Portuguese, Russian, Spanish và danh sách tiếng Việt bổ sung.
- Chuẩn hóa NFKC/NFKD, dấu tiếng Việt, chữ hoa/thường, leetspeak, ký tự Cyrillic/
  Greek tương tự Latin, dấu phân cách, ký tự vô hình và lặp ký tự.
- Dùng whole-word matching và kiểm thử tên hợp lệ để giảm false positive.
- Biệt danh vi phạm nhận HTTP 400 `UNSAFE_NICKNAME`; hệ thống không tự đổi tên rồi
  cho vào phòng.
- Player vi phạm đã tồn tại từ bản cũ bị loại khi reconnect hoặc tải snapshot.

## 10. An toàn và tính đúng

- Helmet, CORS allowlist, giới hạn JSON/upload và Zod bảo vệ lớp HTTP.
- Ownership guard chặn Host sửa quiz/phòng của người khác.
- API công khai không trả đáp án đúng hoặc lời giải của quiz.
- Player JWT gắn với đúng `sessionId`; Host JWT và Player JWT khác loại.
- Join dùng Lua để kiểm tra trạng thái phòng, sức chứa, trùng nickname và ghi Player
  nguyên tử.
- Answer dùng Lua để idempotent, ghi Answer, cộng ZSET và Stream trong một thao tác.
- Session/PIN/player/leaderboard có TTL được gia hạn trong quá trình hoạt động.
- Mỗi tab dùng `sessionStorage`, không dùng chung đáp án qua `localStorage`.
- Modal Có/Không thay hộp trình duyệt cho thao tác nội bộ; `beforeunload` bảo vệ
  reload/đóng tab. Trình duyệt quyết định nội dung cảnh báo `beforeunload`.

## 11. Giao diện và khả năng sử dụng

- Thiết kế màu xanh biển nhẹ, không dùng tím làm màu thương hiệu chính.
- Dark mode có surface/text/border riêng để giữ tương phản.
- Tiếng Việt và tiếng Anh được dịch ở navbar, auth, dashboard, editor, AI, lobby,
  Host Console, Player Game, report và modal.
- Navbar có tìm kiếm quiz, nhập PIN, đổi ngôn ngữ và đổi theme.
- Danh mục có icon vector, trạng thái hover/active và bố cục responsive.
- Hộp thoại xác nhận hỗ trợ click ngoài, phím `Esc`, focus mặc định ở “Không”.
- QR ưu tiên IPv4 LAN hoặc `PUBLIC_WEB_URL`; giao diện giải thích yêu cầu cùng Wi-Fi.

## 12. Dữ liệu demo và kiểm thử nghiệm thu

### Lệnh kiểm tra

```powershell
npm run lint
npm test
npm run build
Invoke-RestMethod http://localhost:4000/api/health
```

### Phạm vi kiểm thử tự động

- Điểm sai bằng 0, điểm tốc độ theo bậc, điểm sàn và câu cuối nhân đôi.
- Chuẩn hóa câu trả lời văn bản.
- Generator từ chủ đề/PDF, AI structured output và CSV import có kiểm tra đáp án.
- Bộ lọc nickname: tên hợp lệ, nhiều ngôn ngữ, tiếng Việt có dấu/không dấu,
  leetspeak, dấu phân cách và ký tự vô hình.
- API/web type-check và production bundle.

### Smoke test thủ công khuyến nghị

1. Đăng ký bằng mã email; đăng nhập bằng username và email.
2. Quên mật khẩu, nhập mã và xác nhận mật khẩu mới.
3. Tạo/publish quiz từ chủ đề/PDF qua AI; tải mẫu và nhập một quiz bằng CSV.
4. Tạo lobby, quét QR bằng điện thoại cùng Wi-Fi.
5. Mở hai tab Player, dùng hai biệt danh/avatar và xác nhận đáp án độc lập.
6. Kiểm tra đếm ngược, preview 5 giây, timer, điểm tốc độ và câu cuối nhân đôi.
7. Tạm dừng/tiếp tục, bỏ qua, kết thúc, replay và báo cáo CSV.
8. Thử biệt danh không an toàn và xác nhận API từ chối.
9. Thử chuyển route/reload ở Host và Player để xác nhận cảnh báo rời phòng.
10. Kiểm tra theme và cả hai ngôn ngữ trên desktop/mobile.

## 13. Giới hạn và hướng mở rộng

- Từ điển moderation không thể bao phủ vĩnh viễn mọi tiếng lóng; danh sách tiếng
  Việt cần được cập nhật dựa trên log moderation và phản hồi thực tế.
- Web Audio hiện tạo nhạc nền tổng hợp, không tải tệp nhạc có bản quyền.
- Production nên dùng HTTPS, secret mạnh, SMTP thật, Redis có auth/TLS và reverse
  proxy giới hạn request.
- Có thể mở rộng bằng LMS/SSO, email kết quả, dashboard analytics, moderation log,
  object storage cho media và Redis Cluster.
