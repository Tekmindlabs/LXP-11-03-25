/**
 * tRPC Provider Component
 * Provides tRPC client to the React component tree
 */

"use client";

import { useState, useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { api } from "./react";
import superjson from "superjson";
import { usePathname } from "next/navigation";

function getBaseUrl() {
  if (typeof window !== 'undefined') return ''; // browser should use relative url
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // SSR should use vercel url
  return `http://localhost:${process.env.PORT ?? 3000}`; // dev SSR should use localhost
}

export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthRoute = pathname?.startsWith('/login') || 
                     pathname?.startsWith('/register') || 
                     pathname?.startsWith('/forgot-password');
  
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 1000,
        retry: isAuthRoute ? 0 : 1,
        refetchOnWindowFocus: false,
        networkMode: 'always',
      },
    },
  }));

  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          headers() {
            const csrfToken = document.cookie
              .split('; ')
              .find(row => row.startsWith('csrf_token='))
              ?.split('=')[1];
            
            return {
              'x-trpc-source': 'react',
              'x-csrf-token': csrfToken || '',
            };
          },
          fetch(url, options) {
            return fetch(url, {
              ...options,
              credentials: 'include',
            }).then(async response => {
              if (!response.ok) {
                const error = await response.json().catch(() => ({}));
                throw new Error(error.message || 'An error occurred');
              }
              return response;
            });
          },
        }),
      ],
      transformer: superjson,
    })
  );

  return (
    <api.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </api.Provider>
  );
} 
