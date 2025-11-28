"use client";

import React from 'react';
import { useLocation } from 'react-router-dom';
import { LayoutDashboard, Scan, Package, History } from 'lucide-react';
import { MobileNav } from './MobileNav';
import { ThemeToggle } from './ThemeToggle';
import UserProfile from './UserProfile';

const getPageTitle = (pathname: string) => {
  switch (pathname) {
    case '/':
      return { title: 'Dashboard', icon: LayoutDashboard };
    case '/opme-scanner':
      return { title: 'Bipagem de OPME', icon: Scan };
    case '/opme-registration':
      return { title: 'Cadastro de OPME', icon: Package };
    case '/linked-opme-view':
      return { title: 'Visualizar Bipagens', icon: History };
    case '/account':
        return { title: 'Minha Conta', icon: UserIcon };
    default:
      return { title: 'Página', icon: LayoutDashboard };
  }
};

const Header = () => {
  const location = useLocation();
  const { title, icon: Icon } = getPageTitle(location.pathname);

  return (
    <header className="flex items-center justify-between p-4 bg-card/80 backdrop-blur-sm border-b border-border sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <MobileNav />
        <div className="hidden md:flex items-center gap-3">
          <Icon className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <UserProfile />
      </div>
    </header>
  );
};

export default Header;