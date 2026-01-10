import React, { Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'sonner';
import ThemeProvider from '@/components/ThemeProvider';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30000,
      refetchOnWindowFocus: false,
    },
  },
});

function LoadingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-white via-purple-50 to-pink-50">
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
        <p className="text-slate-700 font-medium">Đang tải...</p>
      </div>
    </div>
  );
}

export default function AppRoot({ children }) {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <Suspense fallback={<LoadingFallback />}>
            {children}
          </Suspense>
          <Toaster 
            position="top-right"
            richColors
            expand={true}
            duration={4000}
          />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}