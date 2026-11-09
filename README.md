# EarnHub Pro

Website nhiệm vụ/kiếm điểm với giao diện thành viên và khu vực quản trị riêng.

## Công nghệ
- Frontend: React + Vite
- Backend: Node.js + Express
- Database: MongoDB / MongoDB Atlas
- Đăng nhập: JWT + bcrypt
- Giao diện: Dark navy / purple, responsive

## Chức năng
### Thành viên
- Đăng ký, đăng nhập bằng username hoặc email.
- Dashboard, số dư điểm và số dư quy đổi VNĐ.
- Danh sách nhiệm vụ demo (không tự cộng điểm).
- Gửi yêu cầu rút tiền; điểm được giữ/trừ khi tạo yêu cầu.
- Xem lịch sử giao dịch và yêu cầu rút tiền.
- Cập nhật thông tin ngân hàng.

### Quản trị viên
- Dashboard thống kê.
- Tìm kiếm thành viên, xem số dư và trạng thái.
- Cộng/trừ điểm hoặc nhập số tiền VNĐ để quy đổi.
- Đặt lại mật khẩu thành viên.
- Khóa/mở khóa tài khoản.
- Xem, duyệt đã thanh toán hoặc từ chối yêu cầu rút tiền.
- Tạo và bật/tắt nhiệm vụ demo.

## Cài đặt trên Windows / VS Code

### 1. Yêu cầu
- Node.js 20 trở lên
- MongoDB Atlas hoặc MongoDB local

### 2. Backend
Mở CMD:
```bat
cd /d E:\EarnHub-Pro\backend
copy .env.example .env
```
Mở `backend\.env`, điền `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`.
Sau đó:
```bat
npm install
npm run seed:admin
npm run dev
```
Backend mặc định chạy tại `http://localhost:5000`.

### 3. Frontend
Mở CMD thứ hai:
```bat
cd /d E:\EarnHub-Pro\frontend
copy .env.example .env
npm install
npm run dev
```
Mở địa chỉ `Local:` Vite hiển thị (ví dụ `http://localhost:5173`).

**Luôn chạy Backend và Frontend ở hai cửa sổ CMD riêng.** Không chạy `npm run dev` tại thư mục gốc.

## Cấu hình backend/.env
- `MONGODB_URI`: chuỗi kết nối MongoDB.
- `JWT_SECRET`: chuỗi bí mật dài, tự tạo và giữ riêng.
- `ADMIN_USERNAME`: mặc định `EarnHubAdmin`.
- `ADMIN_EMAIL`: mặc định `admin@earnhub.local`.
- `ADMIN_PASSWORD`: mật khẩu Admin do bạn tự đặt.
- `POINTS_PER_VND=10`: 10 điểm = 1 VNĐ.
- `MIN_WITHDRAW_VND=1000`: mức rút tối thiểu.
- `CLIENT_URL`: URL frontend; CORS cũng cho phép localhost Vite từ 5173 đến 5180.

## Lưu ý vận hành quan trọng
1. Đây là bộ mã nguồn nền tảng để chạy thử và phát triển, chưa phải hệ thống tài chính production đã kiểm toán.
2. Nhiệm vụ hiện là DEMO; không cộng điểm chỉ vì người dùng bấm hoặc mở nhiệm vụ. Muốn trả thưởng thật cần tích hợp đối tác và xác minh postback có chữ ký, chống gửi trùng.
3. Admin phải chuyển khoản thật trước khi bấm “Đánh dấu đã chuyển”. Website không tự chuyển tiền ngân hàng.
4. Cần cấu hình HTTPS, sao lưu database, giới hạn quyền truy cập và kiểm thử bảo mật trước khi mở công khai.
5. Không gửi mật khẩu, JWT secret hoặc MongoDB URI cho người khác. Nếu từng lộ thông tin kết nối, hãy đổi mật khẩu Database User trong MongoDB Atlas.

## API chính
- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/wallet`, `GET /api/wallet/transactions`
- `GET /api/tasks`
- `POST /api/withdrawals`, `GET /api/withdrawals`
- `/api/admin/*` (chỉ Admin)
