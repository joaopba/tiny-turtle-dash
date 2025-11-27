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
          {/* DEBUG: Placeholder para verificar se o Outlet está renderizando */}
          <div style={{ border: '2px dashed orange', padding: '20px', margin: '10px', background: 'lightyellow', color: 'black' }}>
            DEBUG: Conteúdo da rota protegida deveria aparecer aqui.
          </div>
          <Outlet />
        </div>
        <MadeWithDyad />
      </main>
    </div>
  );
};

export default Layout;