"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";

// Puerto de getDefaultRoute() (App.tsx original).
export default function Home() {
  const { user, loading, isAdmin, isAmbulante } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (isAdmin) {
      router.replace("/dashboard");
    } else if (isAmbulante) {
      router.replace("/cobro-ambulante");
    } else {
      router.replace("/login");
    }
  }, [loading, user, isAdmin, isAmbulante, router]);

  return <div>Cargando...</div>;
}
