"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 text-foreground z-50">
      <Loader2 className="h-16 w-16 animate-spin text-blue-600 dark:text-blue-400 mb-4" />
      <span className="text-xl font-bold text-gray-700 dark:text-gray-300">Carregando... Por favor, aguarde.</span>
    </div>
  );
};

export default LoadingSpinner;