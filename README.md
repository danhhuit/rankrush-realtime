# RankRush Realtime

RankRush là nền tảng tạo và tổ chức quiz trực tuyến theo thời gian thực. Dự án
tham khảo luồng sử dụng phổ biến của các nền tảng quiz trực tiếp nhưng sử dụng
thương hiệu, giao diện, dữ liệu và mã nguồn độc lập. Logo chính thức là ký hiệu
toán học `R²`.

Ứng dụng gồm một React SPA cho Host/người chơi và một Express API dùng Redis làm
cơ sở dữ liệu chính. Socket.IO truyền snapshot và sự kiện theo phòng; Redis
Sorted Set là nguồn sự thật duy nhất của bảng xếp hạng.

## Chức năng hiện có

### Người chơi

- Tham gia bằng PIN 6 số hoặc QR, không cần tài khoản.
- Tự nhập hoặc gieo xúc xắc để chọn biệt danh; tùy biến avatar người.
- Bộ lọc biệt danh bắt buộc ở API, hỗ trợ nhiều ngôn ngữ, tiếng Việt có
  dấu/không dấu và các cách né lọc bằng ký tự đặc biệt, leetspeak hoặc ký tự
  tương tự Unicode.
- Mỗi tab dùng player token riêng trong `sessionStorage`, vì vậy nhiều người có
  thể chơi trên các tab của cùng trình duyệt mà không dùng chung đáp án.
- Luồng game tự động: đếm ngược bắt đầu, xem câu hỏi và đáp án trong 5 giây,
  trả lời theo timer, xem bảng xếp hạng rồi chuyển câu tiếp theo.
- Không có nút xác nhận đáp án: lựa chọn đầu tiên được gửi ngay và chỉ được ghi
  một lần.
- Điểm câu đúng giảm theo thời gian từ 1000 xuống 100; sai hoặc không trả lời
  nhận 0 điểm. Câu cuối nhân đôi.
- 15 bản nhạc nền tạo bằng Web Audio, có chọn bài, tạm dừng và chỉnh âm lượng.
- Giao diện sáng/tối, tiếng Việt/Anh, kết quả cá nhân và bục chiến thắng.
- Cảnh báo khi rời phòng, tải lại hoặc đóng tab trong lúc chơi.

### Host

- Đăng ký bằng tên đăng nhập, email, mật khẩu và mã xác nhận email 6 số.
- Đăng nhập bằng username hoặc email; quên mật khẩu bằng mã email và xác nhận
  mật khẩu mới.
- Dashboard, Quiz của tôi, Thư viện, Báo cáo, Bảng xếp hạng và Cài đặt tài khoản.
- CRUD quiz/câu hỏi, nhân bản, công khai/bản nháp, sắp xếp câu hỏi và cấu hình
  timer/xáo trộn.
- Tạo quiz tự động từ chủ đề/PDF với ô mô tả chi tiết; nhập CSV theo mẫu khi
  không dùng AI. PDF chỉ được lưu khi AI trả về đủ câu hỏi, đáp án và lời giải
  hợp lệ.
- Tạo lobby có PIN, QR và đường dẫn LAN/public; có thể ẩn thông tin phòng.
- Host chỉ là người điều khiển: tài khoản sở hữu phòng không được tạo Player,
  không tăng số người và không xuất hiện trên bảng xếp hạng.
- Thiết lập đội, ẩn bảng xếp hạng, tắt âm thiết bị người chơi và điểm theo tốc độ.
- Điều khiển bắt đầu, tạm dừng, tiếp tục, bỏ qua câu hỏi, kết thúc hoặc hủy phòng.
- Theo dõi người chơi và tiến độ trả lời realtime; loại người chơi tại lobby.
- Báo cáo theo phiên, bảng xếp hạng Redis, kết quả cá nhân và xuất CSV.
- Hộp xác nhận Có/Không cho thao tác nguy hiểm và cảnh báo khi Host rời phòng
  đang hoạt động.

## Công nghệ

| Lớp         | Công nghệ                                                    |
| ----------- | ------------------------------------------------------------ |
| Web         | React 18, TypeScript, Vite, React Router 7, Socket.IO Client |
| API         | Node.js 20+, Express, Socket.IO, Zod                         |
| Dữ liệu     | Redis 7.4, ioredis, HASH/SET/LIST/STRING/ZSET/STREAM         |
| Xác thực    | JWT, bcrypt, email OTP lưu dạng băm                          |
| Email       | Nodemailer và SMTP                                           |
| AI/tệp      | Ollama, Qwen 2.5, JSON Schema, `pdf-parse`, CSV, Multer      |
| An toàn tên | `@2toad/profanity` và từ điển/chuẩn hóa tiếng Việt           |
| Kiểm thử    | Vitest, Supertest, TypeScript compiler                       |
| Môi trường  | npm workspaces, Docker Compose, RedisInsight tùy chọn        |

## Cấu trúc repository

```text
rankrush-realtime/
├─ apps/
│  ├─ api/                 # Express, Socket.IO, Redis, AI, email
│  │  └─ src/
│  └─ web/                 # React SPA cho Host và Player
│     └─ src/
├─ docs/
│  └─ FEATURES_AND_TECH.md # Phạm vi, kiến trúc, API và tiêu chí nghiệm thu
├─ docker-compose.yml
├─ .env.example
└─ package.json
```

## Yêu cầu môi trường

- Node.js 20 trở lên.
- npm 10 trở lên.
- Docker Desktop hoặc một Redis tương thích tại `localhost:6379`.
- Ollama cần chạy khi tạo từ chủ đề/PDF; CSV là luồng nhập dự phòng không cần AI.
- SMTP là tùy chọn trong development và bắt buộc nếu muốn gửi mã email thật.

## Khởi động development

```powershell
Copy-Item .env.example .env
docker compose up -d redis
npm install
npm run seed
npm run dev
```

- Web development: <http://localhost:5173>
- API: <http://localhost:4000/api>
- Health check: <http://localhost:4000/api/health>
- RedisInsight tùy chọn: chạy `docker compose up -d redisinsight`, sau đó mở
  <http://localhost:5540>

Tài khoản demo sau khi seed:

```text
Username: admin
Password: @dmin123
```

Seed chính tạo 132 bản ghi logic và có thể chạy lại vì chỉ làm mới namespace
`rankrush:*`. Nếu đã có tài khoản/dữ liệu cần giữ lại, dùng `npm run
seed:library` để chỉ bổ sung thư viện quiz mẫu.

## Chạy production trên máy local

```powershell
npm run lint
npm test
npm run build
$env:NODE_ENV="production"
npm run start -w @rankrush/api
```

Ở chế độ production, Express phục vụ cả API và bản build web tại
<http://localhost:4000>.

Nếu gặp `EADDRINUSE: address already in use :::4000`, cổng 4000 đã có một API
đang chạy. Kiểm tra tiến trình thay vì khởi động thêm bản thứ hai:

```powershell
Get-NetTCPConnection -LocalPort 4000 -State Listen |
  Select-Object LocalAddress, LocalPort, OwningProcess
```

## QR và điện thoại khi chạy local

Điện thoại và máy tính phải cùng Wi-Fi. QR tự ưu tiên địa chỉ IPv4 LAN của máy
Host; nên quét bằng Camera, Safari hoặc Chrome thay vì trình duyệt nhúng của
Zalo. Nếu người chơi ở mạng khác, tạo HTTPS tunnel và đặt URL vào `.env`:

```dotenv
PUBLIC_WEB_URL=https://your-public-domain.example
```

Khởi động lại API sau khi đổi biến môi trường.

## AI cục bộ bằng Ollama

Mặc định backend gọi Ollama tại `http://127.0.0.1:11434` với model
`qwen2.5:3b`:

```powershell
ollama pull qwen2.5:3b
ollama list
```

RankRush yêu cầu kết quả theo JSON Schema, kiểm tra lại bằng Zod và luôn lưu quiz
AI ở trạng thái nháp để Host rà soát. Giao diện chỉ hiển thị trạng thái
“Trình tạo câu hỏi AI”, không đưa tên model/công nghệ vào nội dung sản phẩm.
Nếu AI/model chưa sẵn sàng, backend không tạo quiz chung chung từ PDF mà hướng
dẫn Host tải mẫu CSV, điền câu hỏi và đáp án đúng rồi nhập lại.

Ô **Mô tả / yêu cầu chi tiết** được đưa trực tiếp vào prompt để xác định đối
tượng, phạm vi, kiểu dữ kiện và điều cần tránh. Với PDF, model chỉ được dùng dữ
kiện trong tài liệu và phải tự xác định đáp án đúng. Tệp CSV mẫu có thể tải tại
`GET /api/ai/csv-template`; các cột `question`, `type` và `correctAnswer` là bắt
buộc, và backend kiểm tra từng dòng trước khi lưu.

Các biến liên quan nằm trong `.env.example`:

```dotenv
OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5:3b
OLLAMA_TIMEOUT_MS=300000
```

## Gửi mã xác nhận email

Đăng ký và quên mật khẩu dùng mã 6 số, có TTL, giới hạn gửi lại và giới hạn số
lần nhập sai. Mã chỉ lưu dạng băm trong Redis.

```dotenv
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=RankRush <your-email@gmail.com>
```

Với Gmail, dùng App Password thay cho mật khẩu đăng nhập. Trong development,
`EMAIL_DEV_CODE_ENABLED=true` cho phép trả mã thử nếu SMTP chưa cấu hình. Luôn
đặt biến này thành `false` trong production.

`SMTP_USER`/`SMTP_PASS` luôn là thông tin của **một tài khoản gửi**. Mỗi lần đăng
ký hoặc quên mật khẩu, trường `to` được lấy động từ email người dùng vừa nhập;
không tạo một `SMTP_PASS` mới cho từng người nhận. Không commit App Password vào
Git.

## Các lệnh chính

| Lệnh                             | Mục đích                              |
| -------------------------------- | ------------------------------------- |
| `npm run dev`                    | Chạy API và Vite đồng thời            |
| `npm run lint`                   | Type-check toàn bộ workspace          |
| `npm test`                       | Chạy test API và web                  |
| `npm run build`                  | Build API và SPA production           |
| `npm run seed`                   | Làm mới dữ liệu demo `rankrush:*`     |
| `npm run seed:library`           | Bổ sung quiz mẫu, giữ dữ liệu hiện có |
| `npm run start -w @rankrush/api` | Chạy bản API đã build                 |

## Tài liệu chi tiết

Xem [docs/FEATURES_AND_TECH.md](docs/FEATURES_AND_TECH.md) để biết state machine,
cách tính điểm, kiến trúc Redis, API, bảo mật và checklist kiểm thử nghiệm thu.

Hướng dẫn vận hành khu vực quản trị nằm tại
[docs/ADMIN_CONSOLE.md](docs/ADMIN_CONSOLE.md).
