import { QueryClient } from "@tanstack/react-query";

// One client owns authenticated projections in Router loaders, React views
// and native login. Do not create a second cache for pre-route Auth reads.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
