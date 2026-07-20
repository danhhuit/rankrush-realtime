# Phạm vi chức năng và công nghệ RankRush

Tài liệu này là phạm vi chốt cho MVP. RankRush tham khảo luồng tham gia bằng PIN,
quiz editor, lobby, điều khiển trận và các tùy chọn host của
[Quiz.com](https://quiz.com/) và [màn hình vote/lobby](https://quiz.com/play/vote/),
nhưng dùng tên, giao diện, dữ liệu và mã nguồn độc lập.

## Chức năng bắt buộc

### Khách và người chơi

1. Nhập PIN để tham gia mà không cần tài khoản.
2. Chọn biệt danh, avatar, quốc gia và đội (khi bật Team mode).
3. Vào lobby và xem người chơi tham gia theo thời gian thực.
4. Nhận câu hỏi, bộ đếm thời gian và gửi một đáp án duy nhất.
5. Nhận phản hồi đúng/sai, điểm cộng và tổng điểm.
6. Xem Top 10, thứ hạng cá nhân và kết quả cuối.
7. Tự nối lại phiên khi trình duyệt mất kết nối ngắn hạn.

### Host

1. Đăng ký, đăng nhập và nhận diện tài khoản Host/Admin.
2. CRUD quiz và câu hỏi; lọc trạng thái, nháp, công khai, nhân bản và lưu thứ tự câu hỏi.
3. Câu hỏi trắc nghiệm một đáp án, đúng/sai và nhập văn bản.
4. Tạo phòng, PIN 6 chữ số và QR code.
5. Cấu hình timer, xáo trộn câu/đáp án, Team mode, ẩn leaderboard, ẩn quốc kỳ,
   tên an toàn, tắt âm thiết bị và điểm theo tốc độ.
6. Quản lý lobby, loại người chơi, bắt đầu/chuyển câu/kết thúc game.
7. Dashboard live: số người, tiến độ trả lời, Top 10 và xếp hạng đội.
8. Báo cáo theo người chơi/câu hỏi, thời gian phản hồi và xuất CSV.
9. Trang Báo cáo, Bảng xếp hạng và Cài đặt tài khoản có route và dữ liệu riêng.
10. Tìm quiz và nhập PIN trực tiếp trên thanh điều hướng.
11. Giao diện sáng/tối được lưu theo trình duyệt; ngôn ngữ Việt/Anh có thể đổi thủ
    công và tự đổi theo quốc gia người chơi chọn khi tham gia.
12. Mỗi tab giữ player token trong `sessionStorage`, vì vậy nhiều người có thể chơi
    trên các tab khác nhau của cùng trình duyệt mà không ghi đè danh tính.
13. Sau khi kết thúc, mỗi player nhận kết quả riêng gồm hạng, điểm, số câu đúng,
    số câu đã trả lời và độ chính xác.

### Tạo quiz tự động

1. Tạo 3–15 câu hỏi từ một chủ đề phổ biến hoặc từ nội dung PDF.
2. PDF được nhận qua multipart, giới hạn 10 MB và chỉ chấp nhận MIME PDF.
3. Nội dung PDF được trích xuất ở backend; câu hỏi sinh ra luôn là bản nháp.
4. Sau khi tạo, Host được chuyển thẳng đến Quiz Editor để rà soát đáp án, timer
   và lời giải trước khi xuất bản.
5. Backend gọi Ollama cục bộ với model `qwen2.5:3b`, yêu cầu kết quả theo JSON Schema
   và kiểm tra lại bằng Zod trước khi lưu quiz nháp.
6. Khi Ollama tắt, thiếu model hoặc quá thời gian, hệ thống tự chuyển sang bộ sinh
   quy tắc cục bộ để người dùng vẫn tiếp tục được công việc và nhận cảnh báo rõ ràng.
7. `GET /api/ai/status` cho giao diện biết Ollama có kết nối được và model đã sẵn
   sàng hay chưa; không cần API key và nội dung PDF không phải gửi ra dịch vụ đám mây.

### Redis nâng cao bắt buộc

- `ZADD` tạo thành viên leaderboard với điểm 0.
- `ZINCRBY` cộng điểm nguyên tử sau mỗi đáp án.
- `ZREVRANGE ... WITHSCORES` trả Top 10; backend giữ nguyên thứ tự này.
- `ZRANK`/`ZREVRANK` trả vị trí tài khoản đang kết nối.
- `HASH`, `SET`, `LIST`, `STRING + TTL` lưu thực thể và trạng thái phiên.
- Answer idempotency ngăn retry cộng điểm lần hai.

## Chức năng mở rộng

- Thư viện quiz công khai và danh mục.
- Chế độ đội, cờ quốc gia, âm thanh và hiệu ứng nhẹ.
- Có thể bổ sung model Ollama lớn hơn hoặc provider đám mây qua cùng lớp sinh câu hỏi.
- Phân tích nâng cao, email kết quả và tích hợp LMS là hướng phát triển sau.

## Luồng hoạt động đã triển khai

1. Host đăng nhập, tạo/chỉnh sửa quiz và chọn **Tổ chức**.
2. API tạo Session, sinh PIN 6 số có TTL và khởi tạo cấu trúc ZSET.
3. Player tra PIN, chọn nickname/avatar/đội rồi nhận player JWT 24 giờ.
4. Socket.IO đưa Host và Player vào room theo session; reconnect luôn nhận
   snapshot mới nhất từ Redis.
5. Host bắt đầu; câu hỏi được phát theo thứ tự phiên. Nếu bật xáo trộn, thứ tự
   câu được lưu trong Session và đáp án được trộn xác định theo session/câu hỏi.
6. Khi Player trả lời, Lua script kiểm tra idempotency, lưu Answer, cộng điểm
   Player/Team và ghi Stream event trong một thao tác nguyên tử.
7. Host công bố đáp án rồi chuyển câu. Kết thúc trận tạo bục chiến thắng và báo
   cáo chi tiết; Host có thể xuất CSV.

## Kiến trúc

```text
React SPA (Host / Player / Report)
          │ REST + Socket.IO
          ▼
Express API ── JWT / Zod / ownership guards
          │
          ▼
Redis 7.4
├─ HASH: User, Quiz, Question, Session, Player, Answer
├─ SET/LIST: chỉ mục, thành viên phòng, thứ tự câu hỏi
├─ STRING + TTL: ánh xạ PIN → Session
├─ ZSET: leaderboard Player và Team
└─ STREAM: sự kiện join/answer phục vụ audit và mở rộng analytics
```

Web không tự quyết định điểm hay thứ hạng. Socket chỉ truyền thay đổi; Redis là
nguồn sự thật và REST snapshot là cơ chế phục hồi sau mất kết nối.

## Vì sao chọn công nghệ

| Công nghệ          | Vai trò       | Lý do                                                         |
| ------------------ | ------------- | ------------------------------------------------------------- |
| React + TypeScript | Giao diện SPA | Thành phần tái sử dụng, type safety và phản hồi realtime tốt. |
| Vite               | Dev/build web | Khởi động nhanh, cấu hình gọn cho đồ án.                      |
| Express            | REST API      | Dễ trình bày, hệ sinh thái lớn, phù hợp CRUD.                 |
| Socket.IO          | Realtime      | Room, reconnect và fallback tốt cho lobby/game/leaderboard.   |
| Redis              | CSDL chính    | ZSET duy trì thứ tự, thao tác nguyên tử và độ trễ thấp.       |
| ioredis            | Redis client  | Hỗ trợ pipeline, transaction và Lua rõ ràng.                  |
| Zod                | Validation    | Một schema kiểm tra đầu vào có thể đọc và test.               |
| JWT + bcrypt       | Xác thực      | Tách host account và player token ngắn hạn.                   |
| Vitest + Supertest | Test          | Nhanh, phù hợp TypeScript và kiểm thử API.                    |
| Docker Compose     | Môi trường    | Chạy Redis/RedisInsight đồng nhất trên mọi máy.               |
| Multer             | Tải PDF       | Xử lý multipart và giới hạn tệp ngay tại Express.             |
| pdf-parse          | Đọc PDF       | Trích văn bản để tạo câu hỏi có căn cứ tài liệu.              |
| Ollama + Qwen 2.5  | AI cục bộ     | Không cần API key, dữ liệu ở máy và hỗ trợ tiếng Việt tốt.    |
| JSON Schema + Zod  | Output AI     | Buộc cấu trúc 4 đáp án và chặn dữ liệu AI sai định dạng.      |

## API chính

| Nhóm          | Endpoint tiêu biểu                                                 | Mục đích                  |
| ------------- | ------------------------------------------------------------------ | ------------------------- |
| Auth          | `POST /api/auth/register`, `POST /api/auth/login`                  | Tạo và xác thực Host      |
| Quiz          | `GET/POST/PUT/DELETE /api/quizzes`                                 | Thư viện và CRUD quiz     |
| Question      | `POST /api/quizzes/:id/questions`, `PUT/DELETE /api/questions/:id` | Quiz editor               |
| Session       | `POST /api/sessions`, `PATCH /api/sessions/:id/settings`           | Tạo và chốt lobby         |
| Player        | `POST /api/sessions/join`, `POST /api/sessions/:id/answers`        | Tham gia và trả lời       |
| Host control  | `POST .../start`, `POST .../advance`, `POST .../end`               | Điều khiển trận           |
| Result        | `GET .../leaderboard`, `GET .../report`                            | Xếp hạng và báo cáo       |
| AI quiz       | `GET /api/ai/status`, `POST /api/ai/generate-quiz`                 | Kiểm tra AI và tạo quiz   |
| Player result | `GET /api/sessions/:id/result`                                     | Kết quả cá nhân cuối game |

## An toàn và tính đúng

- Mật khẩu băm bằng bcrypt; Host/Player dùng JWT khác loại và thời hạn.
- Ownership guard chặn sửa quiz/phòng không thuộc Host; đáp án editor không xuất
  hiện ở API công khai.
- Khi bật ẩn leaderboard, Player/Public không lấy được bảng điểm hoặc rank qua
  REST lẫn Socket; Host vẫn quan sát được để điều khiển.
- Lua bảo đảm một Player chỉ được ghi một Answer cho mỗi câu, kể cả khi retry.
- Tất cả payload ghi quan trọng được Zod kiểm tra; Helmet và CORS bảo vệ lớp HTTP.

## Dữ liệu demo và kiểm thử nghiệm thu

- Seed: `60 Player + 12 Quiz + 44 Question + 4 Session + 12 Answer = 132`.
- Unit test: điểm sai bằng 0, điểm tốc độ, tắt speed scoring, điểm sàn và chuẩn
  hóa câu trả lời văn bản.
- Integration smoke test: Redis PONG; đăng nhập; tạo/cấu hình phòng; join; start;
  answer; ZSET Top 1; reveal; end; report; kiểm tra 403 và không rò đáp án.
- Visual QA: desktop 1440 px và breakpoint mobile 500 px bằng Chrome headless.
- Ollama smoke test: gửi PDF mẫu, sinh đủ 3 câu hỏi bằng `qwen2.5:3b`, xác nhận
  `provider=OLLAMA` rồi xóa quiz thử khỏi Redis.

## Quy tắc sở hữu dữ liệu

Redis ZSET là nguồn sự thật duy nhất của thứ hạng. Không truy xuất toàn bộ điểm
rồi gọi `sort()` trong Node.js hoặc frontend. Backend chỉ ánh xạ metadata theo
đúng thứ tự Redis trả về.
