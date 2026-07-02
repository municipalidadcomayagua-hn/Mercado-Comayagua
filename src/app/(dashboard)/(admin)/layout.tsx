"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Users, Store, ListOrdered, FileText, Calendar } from "lucide-react";
import { useAuth } from "@/lib/auth/AuthProvider";
import { DashboardShell, type NavItem } from "@/components/layout/DashboardShell";

// Puerto de AdminLayout.tsx + AdminRoute (App.tsx) del original.
// /ambulantes -> /cobradores (ver mapa de nombres, MIGRATION_NOTES.md seccion "Naming").
const NAV_ITEMS: NavItem[] = [
  { path: "/dashboard", label: "Panel", icon: LayoutDashboard, accent: "blue" },
  { path: "/cobradores", label: "Cobradores", icon: Users, accent: "teal" },
  { path: "/mercados", label: "Mercados", icon: Store, accent: "green" },
  { path: "/catalogo-rubros", label: "Catálogo de rubros", icon: ListOrdered, accent: "cyan" },
  {
    path: "/reportes/resumen-cobros",
    label: "Reportes – Resumen por rubro y mercado",
    icon: FileText,
    accent: "purple",
  },
  { path: "/cierre-anual", label: "Cierre anual (mora)", icon: Calendar, accent: "orange" },
];

export default function AdminGroupLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, isAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isAdmin) {
      router.replace("/cobro-ambulante");
    }
  }, [loading, user, isAdmin, router]);

  if (loading || !user || !isAdmin) {
    return <div>Cargando...</div>;
  }

  return (
    <DashboardShell navItems={NAV_ITEMS} subtitle="Administración">
      {children}
    </DashboardShell>
  );
}
