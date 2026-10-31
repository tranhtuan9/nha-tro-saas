-- Module 7 — Thanh toán payOS (UC31, UC32)

-- 1) checkout_url: SDK @payos/node chỉ trả checkoutUrl khi TẠO link
--    (CreatePaymentLinkResponse); lời gọi lấy thông tin giao dịch
--    (paymentRequests.get -> PaymentLink) KHÔNG trả lại địa chỉ này.
--    Phải lưu tại chỗ để trả lại cho client khi Payment PENDING còn hạn.
ALTER TABLE "payments" ADD COLUMN "checkout_url" TEXT;

-- 2) Một link đang mở (PENDING) mỗi hóa đơn. Partial unique index vừa là
--    ràng buộc nghiệp vụ vừa giữ chỗ khi hai request tạo link đồng thời
--    (request thua bắt P2002 -> trả giao dịch hiện có hoặc 409 PAYMENT_IN_PROGRESS).
CREATE UNIQUE INDEX "uq_payment_active_invoice"
  ON "payments"("invoice_id")
  WHERE status = 'PENDING';
