# FloodGuard Hà Tĩnh

Hệ thống tiếp nhận SOS, điều phối đội cứu hộ và theo dõi nhiệm vụ theo thời gian thực. Frontend React/Vite và API Express được phục vụ trên cùng domain; PostgreSQL là kho dữ liệu bắt buộc khi vận hành production.

## Chạy local

Yêu cầu Node.js 20+ và npm. Sao chép `.env.example` thành `.env`, đặt các mật khẩu seed và `JWT_SECRET`, sau đó chạy:

```bash
npm install
npm run build
npm start
```

Mặc định ứng dụng ở `http://localhost:5000`; kiểm tra tiến trình bằng `/api/health` và khả năng phục vụ bằng `/api/readiness`.

## Kiểm tra trước khi phát hành

```bash
npm run check
```

Lệnh này chạy ESLint, kiểm thử chính sách nghiệp vụ và production build. Không phát hành nếu một bước trả mã lỗi khác 0.

## Nguyên tắc vận hành

- Production phải có `DATABASE_URL` và `JWT_SECRET`. Backend sẽ dừng khởi động nếu PostgreSQL không sẵn sàng, tránh âm thầm ghi dữ liệu vào ổ đĩa tạm.
- Chỉ đặt `ALLOW_JSON_FALLBACK=true` cho local/test hoặc một triển khai đơn máy có ổ đĩa bền vững và đã chấp nhận rủi ro.
- Phiên đăng nhập dùng cookie `HttpOnly`; frontend xác minh lại phiên với `/api/auth/session` trước khi mở màn hình có phân quyền.
- Tài khoản cứu hộ chỉ đọc/cập nhật nhiệm vụ thuộc đội của mình. Server kiểm soát luồng chuyển trạng thái và danh sách trường được phép cập nhật.
- Khi nhận `SIGTERM`/`SIGINT`, server ngừng kết nối HTTP/SSE, chờ hàng đợi ghi dữ liệu và đóng PostgreSQL trước khi thoát.
- Mỗi phản hồi có `X-Request-Id`; lỗi API trả JSON kèm request ID để đối chiếu log.
- Thông báo tài khoản realtime là kênh điều phối chính giữa Admin, đội cứu hộ và người dân. SMS điện thoại chỉ là dự phòng và mặc định tắt; chỉ bật bằng `ENABLE_SMS_FALLBACK=true` khi eSMS đã được cấu hình, nạp tiền và kiểm thử.

Chi tiết cấu hình Render/PostgreSQL xem [DEPLOY.md](./DEPLOY.md).

## Tài khoản kiểm thử

Khi các biến `SEED_*_PASSWORD` được cấu hình như `.env` local, có thể đăng nhập bằng:

- Admin: `admin@floodguard.vn` / `admin123`
- Đội cứu hộ: `Rescue@floodguard.vn` / `rescue123`
- Người dân: `User@floodguard.vn` / `citizen123`

Hai tài khoản Rescue/User là alias của dữ liệu seed trưởng đội 1/người dân 1, nên vẫn giữ đúng hồ sơ và quan hệ đội.

## Việc còn cần trước khi phục vụ quy mô lớn

Mã nguồn đã có các chốt an toàn cốt lõi, nhưng một hệ thống cứu hộ thực tế vẫn cần hạ tầng bên ngoài: backup PostgreSQL có kiểm thử khôi phục, giám sát/alert 24/7, quản lý bí mật, kiểm thử tải theo lưu lượng mục tiêu, diễn tập sự cố và kiểm thử thực địa GPS/SMS với thiết bị thật.
