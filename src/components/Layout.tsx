"use client";

import React from "react";
import { Outlet } from "react-router-dom"; // Importar Outlet
import Sidebar from "./Sidebar";
import { MadeWithDyad } from "./made-with-dyad";

const Layout = () => { // Não precisamos mais da prop 'children' aqui
  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <main className="flex-1 flex flex-col">
        <div className="flex-1 p-6">
          <Outlet /> {/* Renderizar o componente da rota aninhada aqui */}
        </div>
        <MadeWithDyad />
      </main>
    </div>
  );
};

export default Layout;