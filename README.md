# RankRush Realtime

Nền tảng tạo và tổ chức quiz trực tuyến thời gian thực, lấy cảm hứng từ luồng trải
nghiệm của Quiz.com nhưng sử dụng thương hiệu, giao diện và mã nguồn độc lập.

Phiên bản hiện tại có tìm kiếm và nhập PIN ngay trên navbar; khu vực Host gồm
Quiz của tôi, Báo cáo, Bảng xếp hạng, Cài đặt và trình tạo quiz tự động từ chủ
đề hoặc PDF. Logo chính thức là ký hiệu toán học `R²`.

## Công nghệ

- React 18, TypeScript, Vite, React Router, Socket.IO Client
- Node.js, Express, Socket.IO, Zod, JWT, bcrypt
- Redis là cơ sở dữ liệu chính; Sorted Set là nguồn sự thật của leaderboard
- Vitest, Supertest và Docker Compose

## Khởi động nhanh

```powershell
Copy-Item .env.example .env
docker compose up -d redis
npm install
npm run seed
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000
- RedisInsight (tùy chọn): chạy `docker compose up -d redisinsight`, sau đó mở
  http://localhost:5540

Tài khoản host demo: `danhtn@rankrush.local` / `RankRush@123`.

### Quét QR bằng điện thoại khi chạy local

Vite lắng nghe trên toàn bộ card mạng và QR tự ưu tiên IPv4 Wi-Fi/LAN của máy
host. Điện thoại cần dùng cùng Wi-Fi với máy tính và nên quét bằng Camera,
Safari hoặc Chrome thay vì trình duyệt nhúng của Zalo. Nếu cần tham gia từ mạng
khác, tạo HTTPS tunnel rồi đặt URL vào `PUBLIC_WEB_URL` trong `.env`; QR sẽ tự
ưu tiên URL công khai này.

Seed tạo **132 bản ghi logic**: 60 Player, 12 Quiz, 44 Question, 4 Session
và 12 Answer. Thư viện gồm nhiều lĩnh vực và nhánh như Art & Literature,
Science & Nature, History & Geography, Technology, Sports, Entertainment và
Education. Lệnh seed có thể chạy lại an toàn vì chỉ xóa namespace `rankrush:*`.

Nếu đã có dữ liệu người dùng, dùng `npm run seed:library` để chỉ bổ sung 8 bộ quiz
theo lĩnh vực mà không xóa hoặc thay đổi dữ liệu hiện có.

### AI cục bộ bằng Ollama

RankRush gọi Ollama từ backend tại `http://127.0.0.1:11434`, ép kết quả theo
JSON Schema và kiểm tra lại bằng Zod trước khi lưu Redis. Model mặc định:
`qwen2.5:3b`.

```powershell
ollama pull qwen2.5:3b
ollama list
```

Nếu CUDA trên Windows không tương thích, đặt biến môi trường người dùng
`OLLAMA_LLM_LIBRARY=cpu_avx2` rồi khởi động lại ứng dụng Ollama. Khi Ollama
không sẵn sàng, RankRush tự dùng bộ sinh câu hỏi cục bộ và thông báo rõ trên
Quiz Editor.

## Kiểm tra và chạy production

```powershell
npm test
npm run build
$env:NODE_ENV="production"
npm run start -w @rankrush/api
```

Ở production, API phục vụ luôn bản build web tại http://localhost:4000.

Xem [docs/FEATURES_AND_TECH.md](docs/FEATURES_AND_TECH.md) để biết phạm vi chức
năng đã chốt, kiến trúc, API, lý do chọn công nghệ và cách Redis đáp ứng đề tài.
