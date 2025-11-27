"use client";

import React from 'react';
import { Loader2 } from 'lucide-react';

const LoadingSpinner = () => {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
      <Loader2 className="h-12 w-12 animate-spin text-primary dark:text-primary-foreground mb-4" />
      <span className="text-lg font-medium text-muted-foreground">Carregando...</span>
    </div>
  );
};

export default LoadingSpinner;