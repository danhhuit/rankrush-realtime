# RankRush Admin Console

## Phạm vi

Trang quản trị nằm tại `/admin` và chỉ chấp nhận tài khoản có `role: ADMIN`.
Theo phạm vi giao diện đã duyệt, trang gồm:

- Tổng quan hệ thống.
- Quản lý người dùng và quyền Admin/Host.
- Theo dõi, mở bảng điều khiển và dừng phòng chơi.
- Nhật ký sự kiện phòng chơi và thao tác quản trị.
- Thống kê Redis và các kiểu dữ liệu trong namespace RankRush.
- Trợ lý tạo câu hỏi, lưu kết quả thành quiz nháp để kiểm tra.

Trang không thêm các mục Câu hỏi & Bộ đề, Bảng xếp hạng, Báo cáo sau phiên và
Kiểm thử trong khu vực Admin. Các chức năng Host tương ứng vẫn giữ nguyên.

## Chạy development

Yêu cầu Node.js 20+, npm 10+ và Redis đang lắng nghe ở cổng được cấu hình trong
`.env` (mặc định là `localhost:6379`).

```powershell
Set-Location C:\dev\rankrush-realtime
Copy-Item .env.example .env -ErrorAction SilentlyContinue
docker compose up -d redis
docker exec rankrush-redis redis-cli ping
npm install
npm run lint
npm test
npm run build
npm run seed
npm run dev
```

`npm run seed` làm mới toàn bộ namespace `rankrush:*`. Không chạy lệnh này trên
dữ liệu cần giữ. Nếu chỉ muốn thêm thư viện quiz mẫu, dùng `npm run
seed:library`.

Sau khi seed, đăng nhập tại `http://localhost:5173/login`:

```text
Username: admin
Email:    admin@rankrush.local
Password: @dmin123
```

Tài khoản Admin được chuyển tự động đến `http://localhost:5173/admin`. Tài khoản
Host thông thường vẫn đi đến `/dashboard`.

Nếu Redis đang có dữ liệu cần giữ, không cần chạy lại seed. Dùng lệnh sau để tạo
hoặc cập nhật riêng tài khoản Admin:

```powershell
npm run admin:setup
```

Lệnh này không xóa quiz, phòng chơi, người dùng hoặc namespace Redis hiện có.

## API quản trị

Mọi endpoint dưới đây yêu cầu JWT Host có vai trò `ADMIN`. Server còn đọc lại
tài khoản từ Redis ở mỗi request để token cũ không giữ được quyền sau khi tài
khoản bị hạ quyền hoặc tạm khóa.

| Method | Endpoint               | Chức năng                                |
| ------ | ---------------------- | ---------------------------------------- |
| GET    | `/api/admin/overview`  | Số liệu và bản ghi gần đây               |
| GET    | `/api/admin/users`     | Danh sách người dùng                     |
| PATCH  | `/api/admin/users/:id` | Đổi vai trò hoặc trạng thái              |
| GET    | `/api/admin/sessions`  | Danh sách phòng chơi                     |
| GET    | `/api/admin/activity`  | Đọc Redis Streams                        |
| GET    | `/api/admin/system`    | INFO, DBSIZE và thống kê namespace Redis |

Admin không thể tự hạ quyền hoặc tự khóa. Hệ thống cũng không cho phép hạ quyền
hoặc khóa quản trị viên hoạt động cuối cùng.

## Theme và ngôn ngữ

Admin Console dùng chung cài đặt với SPA:

- `Theo hệ thống`: tự đổi sáng/tối theo Windows/macOS và cập nhật ngay khi hệ
  điều hành đổi theme.
- `Sáng` hoặc `Tối`: ghi đè theo lựa chọn của người dùng.
- `VI` hoặc `EN`: đổi ngôn ngữ giao diện Admin.

Lựa chọn được lưu trong `localStorage` của trình duyệt.

## Đưa thay đổi lên Git

```powershell
git switch -c feature/admin-console
git status --short
git add apps/api/src apps/web/src apps/web/index.html apps/web/vite.config.ts docs/ADMIN_CONSOLE.md
git commit -m "feat: add Redis-backed admin console"
git push -u origin feature/admin-console
```

Nếu Git báo `dubious ownership` trên ổ không lưu quyền sở hữu, có thể đánh dấu
đúng repository này là an toàn:

```powershell
git config --global --add safe.directory F:/rankrush-realtime
```

Nếu ổ `F:` là exFAT/ổ di động và `npm install` tiếp tục lỗi workspace symlink
`EISDIR`, hãy clone repository sang một thư mục NTFS như
`C:\dev\rankrush-realtime` rồi chạy lại. Docker đã chạy không thể sửa lỗi
filesystem/symlink của npm; đây là hai lớp độc lập.
