"use client";

import { Component, ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { PreferencesProvider } from '@/contexts/preferences-context';
import { ThemeProvider } from '@/providers/theme-provider';
import { Providers } from "@/providers";

// Custom error boundary component
class ErrorBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; fallback: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

// Error boundary fallback component
function ErrorFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
      <p className="text-gray-700 mb-4">{error.message}</p>
      <div className="flex gap-4">
        <button 
          onClick={() => window.location.href = '/login'}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Go to Login
        </button>
        <button 
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

// Dynamically import the TRPCProvider with loading fallback
const TRPCProvider = dynamic(
  () => import('@/trpc/provider').then(mod => ({ default: mod.TRPCProvider })),
  { 
    ssr: false,
    loading: () => <div className="flex min-h-screen items-center justify-center">Loading application...</div>
  }
);

// Dynamically import the AppShellWrapper with loading fallback
const AppShellWrapper = dynamic(
  () => import('@/components/layout/app-shell-wrapper').then(mod => ({ default: mod.AppShellWrapper })),
  { 
    ssr: false,
    loading: () => <div className="flex min-h-screen items-center justify-center">Loading shell...</div>
  }
);

export function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary fallback={<ErrorFallback error={new Error("An error occurred in the application")} reset={() => window.location.reload()} />}>
      <TRPCProvider>
        <PreferencesProvider>
          <ThemeProvider>
            <Providers>
              <AppShellWrapper>{children}</AppShellWrapper>
            </Providers>
          </ThemeProvider>
        </PreferencesProvider>
      </TRPCProvider>
    </ErrorBoundary>
  );
} 