"use client";

import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useSession } from './SessionContextProvider';
import LoadingSpinner from './LoadingSpinner';

interface RoleProtectedRouteProps {
  allowedRoles: string[];
}

const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ allowedRoles }) => {
  const { profile, loading } = useSession();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (!profile || !allowedRoles.includes(profile.role as string)) {
    // Redireciona para a página inicial se o usuário não tiver a permissão necessária
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};

export default RoleProtectedRoute;