"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button"; // Adicionado Button aqui

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    // Atualiza o estado para que a próxima renderização mostre a UI de fallback.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Erro não capturado pelo ErrorBoundary:", error, errorInfo);
    // Você pode logar o erro para um serviço de monitoramento aqui
  }

  public render() {
    if (this.state.hasError) {
      // Você pode renderizar qualquer UI de fallback personalizada
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-destructive-foreground text-destructive p-4">
          <h1 className="text-4xl font-bold mb-4">Oops! Algo deu errado.</h1>
          <p className="text-xl text-destructive-foreground mb-6">
            Houve um problema ao carregar esta parte da aplicação.
          </p>
          {this.props.fallback || (
            <Button onClick={() => window.location.reload()} className="mt-4">
              Recarregar Página
            </Button>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;