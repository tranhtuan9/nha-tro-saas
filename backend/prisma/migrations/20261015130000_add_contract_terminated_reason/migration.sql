-- Phần C (UC15): thêm cột lý do chấm dứt hợp đồng cho PATCH /contracts/:id/terminate
ALTER TABLE "contracts" ADD COLUMN "terminated_reason" text;
