"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Package, Scan, Home, History, LogOut, LayoutDashboard } from "lucide-react";
import { useSession } from "./SessionContextProvider";
import { Button } from "./ui/button";

const Sidebar = () => {
  const location = useLocation();
  const { supabase } = useSession();

  const navItems = [
    {
      name: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      name: "Bipagem de OPME",
      href: "/opme-scanner",
      icon: Scan,
    },
    {
      name: "Cadastro de OPME",
      href: "/opme-registration",
      icon: Package,
    },
    {
      name: "Visualizar Bipagens",
      href: "/linked-opme-view",
      icon: History,
    },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // O SessionContextProvider lidará com o redirecionamento para /login
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4 flex flex-col h-screen sticky top-0">
      <div className="mb-8 flex items-center justify-center py-4">
        <img src="https://ranucleodeendoscopia.com.br/wp-content/themes/ra-v1/images/logo/logo-grupora-endoscopia.png" alt="Grupo RA Endoscopia Logo" className="h-14 w-auto" />
      </div>
      <nav className="flex-1">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                    : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                {item.name}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="mt-auto pt-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default Sidebar;