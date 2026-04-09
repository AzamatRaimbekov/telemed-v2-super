import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider, createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { useAuthStore } from "@/stores/auth-store";
import { queryClient } from "@/lib/query-client";

const router = createRouter({
  routeTree,
  context: { queryClient, auth: undefined! },
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

export default function App() {
  const auth = useAuthStore();
  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} context={{ auth, queryClient }} />
    </QueryClientProvider>
  );
}
