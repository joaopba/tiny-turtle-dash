"use client";

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContextProvider';
import LoadingSpinner from './LoadingSpinner';

const ProtectedRoute = () => {
  const { session, loading } = useSession();
  const location = useLocation();

  if (loading) {
    console.log("ProtectedRoute: Verificação de sessão em andamento. Renderizando LoadingSpinner.");
    return <LoadingSpinner />;
  }

  if (!session) {
    console.log("ProtectedRoute: Nenhuma sessão encontrada após o carregamento, redirecionando para /login.");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  console.log("ProtectedRoute: Sessão válida encontrada. Renderizando Outlet.");
  return <Outlet />;
};

export default ProtectedRoute;