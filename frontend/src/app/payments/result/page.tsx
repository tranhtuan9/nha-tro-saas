import type { Metadata } from "next";
import { Suspense } from "react";
import { PaymentResult } from "./payment-result";

export const metadata: Metadata = { title: "Kết quả thanh toán" };

export default function PaymentResultPage() {
  return (
    <Suspense>
      <PaymentResult />
    </Suspense>
  );
}
