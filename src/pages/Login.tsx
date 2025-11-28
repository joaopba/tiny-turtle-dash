"use client";

import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '@/integrations/supabase/client';
import { MadeWithDyad } from '@/components/made-with-dyad';
import { useSession } from '@/components/SessionContextProvider';
import { Navigate } from 'react-router-dom';

function Login() {
  const { session } = useSession();

  if (session) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 text-gray-900 dark:text-gray-100 p-4">
      <div className="w-full max-w-md p-8 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700">
        <div className="flex justify-center mb-6">
          <img src="https://ranucleodeendoscopia.com.br/wp-content/themes/ra-v1/images/logo/logo-grupora-endoscopia.png" alt="Grupo RA Endoscopia Logo" className="h-16 w-auto" />
        </div>
        <h1 className="text-2xl font-bold text-center mb-2 text-gray-800 dark:text-gray-200">Acesse sua conta</h1>
        <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Bem-vindo ao sistema de gerenciamento de OPME.</p>
        <Auth
          supabaseClient={supabase}
          providers={[]}
          view="sign_in"
          showLinks={false}
          localization={{
            variables: {
              sign_in: {
                email_label: 'Seu endereço de e-mail',
                password_label: 'Sua senha',
                email_input_placeholder: 'seu@email.com',
                password_input_placeholder: '••••••••',
                button_label: 'Entrar',
                loading_button_label: 'Entrando...',
                social_provider_text: 'Entrar com {{provider}}',
              },
              forgotten_password: {
                email_label: 'Seu endereço de e-mail',
                password_label: 'Sua senha',
                email_input_placeholder: 'seu@email.com',
                button_label: 'Enviar instruções',
                loading_button_label: 'Enviando...',
                link_text: 'Esqueceu sua senha?',
              },
              update_password: {
                password_label: 'Nova senha',
                password_input_placeholder: 'Sua nova senha',
                button_label: 'Atualizar senha',
                loading_button_label: 'Atualizando...',
              },
            },
          }}
          appearance={{
            theme: ThemeSupa,
            variables: {
              default: {
                colors: {
                  brand: 'hsl(var(--primary))',
                  brandAccent: 'hsl(var(--primary-foreground))',
                  defaultButtonBackground: 'hsl(var(--primary))',
                  defaultButtonBackgroundHover: 'hsl(var(--primary-foreground))',
                  defaultButtonBorder: 'hsl(var(--primary))',
                  defaultButtonText: 'hsl(var(--primary-foreground))',
                  inputBackground: 'hsl(var(--input))',
                  inputBorder: 'hsl(var(--border))',
                  inputBorderHover: 'hsl(var(--ring))',
                  inputBorderFocus: 'hsl(var(--ring))',
                  inputText: 'hsl(var(--foreground))',
                },
                radii: {
                  borderRadiusButton: 'var(--radius)',
                  buttonBorderRadius: 'var(--radius)',
                  inputBorderRadius: 'var(--radius)',
                },
              },
            },
          }}
          theme="light"
          redirectTo={window.location.origin}
        />
      </div>
      <div className="mt-8">
        <MadeWithDyad />
      </div>
    </div>
  );
}

export default Login;