"use client";

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContextProvider';
import LoadingSpinner from './LoadingSpinner'; // Import LoadingSpinner

const ProtectedRoute = () => {
  const { session, supabase } = useSession(); // useSession já lida com seu próprio estado de carregamento
  const location = useLocation();

  // useSession já retorna LoadingSpinner se estiver carregando.
  // Então, se chegarmos aqui, a sessão é nula (não autenticada) ou uma sessão real.

  // Adicionando um log para verificar o estado da sessão no ProtectedRoute
  console.log("ProtectedRoute: Verificando sessão. Session:", session);

  if (session === undefined) { // Este caso deve ser tratado pelo LoadingSpinner do SessionContextProvider
    console.log("ProtectedRoute: Sessão é indefinida, provavelmente ainda carregando no SessionContextProvider.");
    return <LoadingSpinner />; // Fallback, embora SessionContextProvider deva capturar isso
  }

  if (!session) {
    console.log("ProtectedRoute: Nenhuma sessão encontrada, redirecionando para /login. Origem:", location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log("ProtectedRoute: Sessão encontrada, renderizando Outlet.");
  return <Outlet />;
};

export default ProtectedRoute;