"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Home, MapPin, Receipt, CalendarDays, Wallet } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DashboardShell, type NavItem } from "@/components/layout/DashboardShell";
import { LoadingScreen } from "@/components/layout/LoadingScreen";

// Puerto de AmbulanteLayout.tsx + ProtectedRoute (App.tsx) del original.
const NAV_ITEMS: NavItem[] = [
  { path: "/cobro-ambulante", label: "Inicio", icon: Home, accent: "blue" },
  { path: "/cobro-ambulante/espacios", label: "Locatarios", icon: MapPin, accent: "teal" },
  { path: "/cobro-ambulante/pagos-mensuales", label: "Cobros mensuales", icon: Receipt, accent: "cyan" },
  { path: "/cobro-ambulante/pagos-diarios", label: "Pagos diarios", icon: CalendarDays, accent: "orange" },
  { path: "/cobro-ambulante/estado-cuenta", label: "Estado de cuenta", icon: Wallet, accent: "green" },
];

export default function CobradorGroupLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return <LoadingScreen />;
  }

  return (
    <DashboardShell navItems={NAV_ITEMS} subtitle="Cobrador" mostrarMercado>
      {children}
    </DashboardShell>
  );
}
