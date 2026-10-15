# Quy tắc nghiệp vụ

## Tài khoản
- Admin: tạo bằng seed, không có màn hình đăng ký.
- Landlord: tự đăng ký (UC08) → tạo Tenant (gói mặc định, hạn dùng thử) + User LANDLORD, một transaction.
- Renter: không tự đăng ký. Landlord thêm hồ sơ (UC14) → tạo User RENTER + gửi email mời đặt mật khẩu (dùng PasswordResetToken).
- Đăng nhập (UC01, UC09, UC24): sai mật khẩu → bị khóa → Tenant tạm ngưng (Landlord, Renter). Cấp JWT gồm userId, role, tenantId.

## Tenant và gói dịch vụ
- Tenant tạo tự động khi Landlord đăng ký. Admin tạm ngưng/kích hoạt (UC05), đổi gói và gia hạn (UC07), quản lý gói (UC06).
- Tenant SUSPENDED: mọi người dùng thuộc Tenant không đăng nhập được.
- Hết hạn (subscription_end < hôm nay): vẫn đăng nhập và xem; không tạo mới nhà trọ, phòng, người thuê, hợp đồng, chỉ số, dịch vụ, hóa đơn.
- Giới hạn gói: không vượt max_properties, max_rooms khi tạo mới.
  + max_properties chỉ đếm nhà trọ đang hoạt động (is_active = true).
  + max_rooms chỉ đếm phòng thuộc nhà trọ đang hoạt động.
  + Kiểm tra giới hạn và INSERT nằm trong MỘT transaction, khóa dòng Tenant (SELECT ... FOR UPDATE) để tránh vượt giới hạn khi có nhiều request đồng thời.
- Thu phí gói nằm ngoài phạm vi; Admin tự gán gói và ngày hết hạn.

## Nhà trọ và Phòng
- Chỉ ẩn nhà trọ (is_active = false), KHÔNG có chức năng kích hoạt lại; PATCH không nhận is_active.
- Không ẩn nhà trọ đang có hợp đồng ACTIVE (bất kỳ phòng nào thuộc nhà trọ) → 409.
- Không tạo/sửa phòng trỏ vào nhà trọ đã ẩn → 400; vẫn xem/sửa phòng cũ thuộc nhà trọ đã ẩn.
- Mã phòng duy nhất trong phạm vi một nhà trọ.
- Chỉ cho đổi nhà trọ (property_id) của phòng khi phòng CHƯA phát sinh dữ liệu nghiệp vụ (không có hợp đồng, chỉ số điện nước, hóa đơn);
  nếu đã có → 409 với mã lỗi tương ứng: ROOM_HAS_INVOICE (hóa đơn), ROOM_HAS_METER_READING (chỉ số điện nước), ROOM_HAS_CONTRACT (hợp đồng).
- Không đổi trạng thái phòng đang có hợp đồng ACTIVE; chỉ đặt AVAILABLE/MAINTENANCE, không đặt OCCUPIED thủ công.
- Gói hết hạn: vẫn xem và sửa; chỉ chặn TẠO MỚI nhà trọ/phòng (POST).

## Thứ tự dữ liệu
Đăng ký → Nhà trọ → Phòng → Dịch vụ → Người thuê → Hợp đồng → Chỉ số điện nước → Hóa đơn → Thanh toán.

## Hóa đơn
- Tiền điện/nước = lượng tiêu thụ × đơn giá của Property tại thời điểm lập (lưu snapshot vào Invoice).
- Dịch vụ: chỉ chọn từ danh mục Service đang hoạt động; lưu snapshot vào InvoiceLineItem.
- total_amount = rent + electricity + water + service. Mỗi hợp đồng một hóa đơn mỗi kỳ.

## Thanh toán, AI, phản ánh
- Thanh toán qua payOS; trạng thái chỉ đổi khi Webhook hợp lệ (đúng chữ ký, order_code, số tiền).
- AI: tra cứu chạy ngay; ghi dữ liệu phải có xem trước và xác nhận (UC22, UC23).
- Phản ánh: Renter gửi (UC33), Landlord phản hồi và đổi trạng thái (UC20); mỗi lần có Notification.

## Danh sách 33 Use Case
Admin: UC01 Đăng nhập, UC02 Quên mật khẩu, UC03 Hồ sơ cá nhân, UC04 Quản lý người dùng, UC05 Quản lý Tenant, UC06 Quản lý gói dịch vụ SaaS, UC07 Theo dõi đăng ký.
Landlord: UC08 Đăng ký, UC09 Đăng nhập, UC10 Quên mật khẩu, UC11 Hồ sơ, UC12 Nhà trọ, UC13 Phòng, UC14 Người thuê, UC15 Hợp đồng, UC16 Chỉ số điện nước, UC17 Dịch vụ, UC18 Lập và quản lý hóa đơn, UC19 Theo dõi thanh toán, UC20 Tiếp nhận và phản hồi phản ánh, UC21 Tra cứu bằng ngôn ngữ tự nhiên, UC22 Thực hiện nghiệp vụ bằng AI, UC23 Xác nhận thao tác AI.
Renter: UC24 Đăng nhập, UC25 Quên mật khẩu, UC26 Hồ sơ, UC27 Xem phòng, UC28 Xem hợp đồng, UC29 Theo dõi chỉ số điện nước, UC30 Xem hóa đơn, UC31 Thanh toán trực tuyến, UC32 Lịch sử thanh toán, UC33 Gửi phản ánh/yêu cầu hỗ trợ.