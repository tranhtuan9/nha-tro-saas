-- Ràng buộc nghiệp vụ: lượng tiêu thụ điện/nước không bao giờ âm.
-- Khi chỉ số mới nhỏ hơn kỳ trước (thay đồng hồ) và Landlord xác nhận (confirmAnomaly),
-- server tính usage = chỉ số mới (đếm từ 0), KHÔNG lưu giá trị âm.
ALTER TABLE "meter_readings"
  ADD CONSTRAINT "meter_readings_usage_non_negative"
  CHECK ("electricity_usage" >= 0 AND "water_usage" >= 0);
