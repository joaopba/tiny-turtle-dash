"use client";

import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { MadeWithDyad } from "./made-with-dyad";

const Layout = () => {
  console.log("Layout: Componente Layout renderizado.");
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-6">
          <Outlet />
        </div>
        <MadeWithDyad />
      </main>
    </div>
  );
};

export default Layout;