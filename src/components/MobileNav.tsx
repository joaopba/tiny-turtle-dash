"use client";

import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, Package, Scan, History, LogOut, LayoutDashboard, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useSession } from "./SessionContextProvider";

const navItems = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard, roles: ['GESTOR', 'OPERADOR'] },
  { name: "Bipagem de OPME", href: "/opme-scanner", icon: Scan, roles: ['GESTOR', 'OPERADOR'] },
  { name: "Visualizar Bipagens", href: "/linked-opme-view", icon: History, roles: ['GESTOR', 'OPERADOR'] },
  { name: "Cadastro de OPME", href: "/opme-registration", icon: Package, roles: ['GESTOR'] },
  { name: "Gerenciar Usuários", href: "/user-management", icon: Users, roles: ['GESTOR'] },
];

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const { supabase, profile } = useSession();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setOpen(false);
  };

  const userRole = profile?.role || 'OPERADOR';

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
        >
          <Menu className="h-6 w-6" />
          <span className="sr-only">Toggle navigation menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="flex flex-col w-64 bg-sidebar text-sidebar-foreground p-4">
        <div className="mb-8 flex items-center justify-center py-4">
          <img src="https://ranucleodeendoscopia.com.br/wp-content/themes/ra-v1/images/logo/logo-grupora-endoscopia.png" alt="Grupo RA Endoscopia Logo" className="h-14 w-auto" />
        </div>
        <nav className="flex-1">
          <ul className="space-y-2">
            {navItems.filter(item => item.roles.includes(userRole)).map((item) => (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors",
                    location.pathname === item.href
                      ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-md"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  onClick={() => setOpen(false)}
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
      </SheetContent>
    </Sheet>
  );
}