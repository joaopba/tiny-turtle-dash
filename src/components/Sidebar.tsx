"use client";

import React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Package, Scan, Home, History, LogOut } from "lucide-react"; // Added LogOut icon
import { useSession } from "./SessionContextProvider"; // Import useSession
import { Button } from "./ui/button"; // Import Button

const Sidebar = () => {
  const location = useLocation();
  const { supabase } = useSession(); // Get supabase client from context

  const navItems = [
    {
      name: "Início",
      href: "/",
      icon: Home,
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
    // The SessionContextProvider will handle the redirect to /login
  };

  return (
    <aside className="w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border p-4 flex flex-col h-full">
      <div className="text-2xl font-bold mb-8 text-sidebar-primary-foreground">Dyad OPME</div>
      <nav className="flex-1">
        <ul className="space-y-2">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                  location.pathname === item.href
                    ? "bg-sidebar-primary text-sidebar-primary-foreground"
                    : "text-sidebar-foreground"
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
          className="w-full justify-start flex items-center gap-3 text-sm font-medium text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
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