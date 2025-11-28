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
      <main className="flex-1 flex flex-col p-6 lg:p-10">
        <div className="flex-1 max-w-7xl mx-auto w-full">
          <Outlet />
        </div>
        <MadeWithDyad />
      </main>
    </div>
  );
};

export default Layout;