"use client";

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContextProvider';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = () => {
  const { session } = useSession(); // useSession já lida com seu próprio estado de carregamento
  const location = useLocation();

  console.log("ProtectedRoute: Verificando sessão. Session:", session);

  if (session === undefined) {
    console.log("ProtectedRoute: Sessão é indefinida, provavelmente ainda carregando no SessionContextProvider. Renderizando LoadingSpinner.");
    return <LoadingSpinner />;
  }

  if (!session) {
    console.log("ProtectedRoute: Nenhuma sessão encontrada, redirecionando para /login. Origem:", location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log("ProtectedRoute: Sessão encontrada, renderizando Outlet.");
  return <Outlet />;
};

export default ProtectedRoute;