"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { FullScreenSpinner } from "@/components/guards";
import { useAuth } from "@/lib/auth-context";
import { getHomePathForRole } from "@/lib/navigation";

export default function Home() {
  const { token, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!token) {
      router.replace("/login");
      return;
    }
    if (user) {
      router.replace(getHomePathForRole(user.role));
    }
  }, [token, user, router]);

  return <FullScreenSpinner />;
}
