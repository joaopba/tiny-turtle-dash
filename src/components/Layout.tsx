"use client";

import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import { MadeWithDyad } from "./made-with-dyad";
import Header from "./Header";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ThemeProvider } from "next-themes";
import ErrorBoundary from "./ErrorBoundary";

const Layout = () => {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Sidebar para telas maiores */}
        <div className="hidden md:block">
          <ResizablePanelGroup
            direction="horizontal"
            className="min-h-screen w-full"
          >
            <ResizablePanel defaultSize={18} minSize={15} maxSize={25} className="bg-card">
              <Sidebar />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={82}>
              <div className="flex flex-col h-full">
                <Header />
                <main className="flex-1 flex flex-col p-6 lg:p-8 overflow-y-auto bg-secondary/40">
                  <div className="flex-1 max-w-full mx-auto w-full">
                    <ErrorBoundary>
                      <Outlet />
                    </ErrorBoundary>
                  </div>
                  <MadeWithDyad />
                </main>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>

        {/* Layout para telas menores */}
        <div className="flex flex-col flex-1 md:hidden">
          <Header />
          <main className="flex-1 flex flex-col p-4 bg-secondary/40">
            <div className="flex-1 w-full">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
            <MadeWithDyad />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
};

export default Layout;