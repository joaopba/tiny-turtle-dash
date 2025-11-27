"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import LoadingSpinner from './LoadingSpinner';

interface SessionContextType {
  session: Session | null;
  supabase: SupabaseClient;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionContextProvider = ({ children }: { children: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    console.log("SessionContextProvider: Iniciando listener de autenticação e buscando sessão inicial.");

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        console.log("SessionContextProvider: Auth state change event:", event);
        console.log("SessionContextProvider: Current session from auth state change:", currentSession);
        setSession(currentSession);
        setLoading(false); // Garante que o loading seja false após qualquer mudança de estado
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log("SessionContextProvider: Initial session from getSession():", session);
      setSession(session);
      setLoading(false); // Garante que o loading seja false após a verificação inicial
    }).catch(error => {
      console.error("SessionContextProvider: Erro ao obter sessão inicial:", error);
      setLoading(false); // Garante que o loading seja false mesmo em caso de erro
    });

    return () => {
      console.log("SessionContextProvider: Desinscrevendo do listener de autenticação.");
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    console.log("SessionContextProvider: Renderizando LoadingSpinner.");
    return <LoadingSpinner />;
  }

  console.log("SessionContextProvider: Renderizando children com sessão:", session);
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