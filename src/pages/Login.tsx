"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { Navigate } from 'react-router-dom';

function Login() {
  const { session } = useSession();

  // Se o usuário já estiver logado, redirecionar para a página inicial
  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-3xl font-bold text-center mb-6">Bem-vindo</h1>
        <Auth
          supabaseClient={supabase}
          providers={[]} // Apenas e-mail/senha por enquanto
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                },
              },
            },
          }}
          theme="light" // Usar tema claro, ajustar se o modo escuro for preferido
          redirectTo={window.location.origin} // Redirecionar para a origem atual após o login
        />
      </div>
      <MadeWithDyad />
    </div>
  );
}

export default Login;