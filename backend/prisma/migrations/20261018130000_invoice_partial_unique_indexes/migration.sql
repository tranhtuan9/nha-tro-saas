-- Hóa đơn: cho phép hủy rồi lập lại trong cùng kỳ.
-- Bỏ 2 unique toàn phần, thay bằng partial unique index chỉ áp cho hóa đơn CHƯA HỦY
-- (status <> 'CANCELLED'): mỗi hợp đồng một hóa đơn mỗi kỳ, mỗi chỉ số một hóa đơn.
DROP INDEX "invoices_contract_id_billing_month_key";
DROP INDEX "invoices_meter_reading_id_key";

CREATE UNIQUE INDEX "uq_invoice_active_contract_month"
  ON "invoices"("contract_id", "billing_month")
  WHERE status <> 'CANCELLED';

CREATE UNIQUE INDEX "uq_invoice_active_meter_reading"
  ON "invoices"("meter_reading_id")
  WHERE status <> 'CANCELLED';
