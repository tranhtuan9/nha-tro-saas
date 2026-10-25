import type { Metadata } from "next";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Đăng ký chủ nhà trọ" };

export default function RegisterPage() {
  return <RegisterForm />;
}
