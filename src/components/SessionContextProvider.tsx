"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useLocation } from 'react-router-dom';

interface SessionContextType {
  session: Session | null;
  supabase: SupabaseClient;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    console.log("SessionContextProvider: Initializing auth listener.");
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("SessionContextProvider: Auth state changed. Event:", event, "Session:", currentSession);
        setSession(currentSession);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          console.log("SessionContextProvider: SIGNED_IN. Redirecting to /.");
          navigate('/');
        } else if (event === 'SIGNED_OUT') {
          console.log("SessionContextProvider: SIGNED_OUT. Redirecting to /login.");
          navigate('/login');
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("SessionContextProvider: Initial getSession result:", session);
      setSession(session);
      setLoading(false);
      if (!session && location.pathname !== '/login') {
        console.log("SessionContextProvider: No session and not on login page. Redirecting to /login.");
        navigate('/login');
      }
    }).catch(error => {
      console.error("SessionContextProvider: Error getting session:", error);
      setLoading(false);
      if (location.pathname !== '/login') {
        navigate('/login');
      }
    });

    return () => {
      console.log("SessionContextProvider: Unsubscribing auth listener.");
      authListener.subscription.unsubscribe();
    };
  }, [navigate, location.pathname]);

  if (loading) {
    console.log("SessionContextProvider: Rendering loading state.");
    return <div className="flex items-center justify-center min-h-screen">Carregando...</div>;
  }

  console.log("SessionContextProvider: Rendering children. Current session:", session);
  return (
    <SessionContext.Provider value={{ session, supabase }}>
      {children}
    </SessionContext.Provider>
  );
};

export const useSession = () => {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionContextProvider');
  }
  return context;
};