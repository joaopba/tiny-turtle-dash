"use client";

import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from './SessionContextProvider';

const ProtectedRoute = () => {
  const { session, supabase } = useSession();
  const location = useLocation();

  // If session is null, redirect to login
  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If session exists, render the child routes
  return <Outlet />;
};

export default ProtectedRoute;