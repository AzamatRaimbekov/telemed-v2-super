import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      staleTime: 30000,      // 30 seconds
      gcTime: 300000,        // 5 minutes (was cacheTime)
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});
