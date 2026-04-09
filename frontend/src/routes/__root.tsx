import { createRootRouteWithContext, Outlet } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";

interface RouterContext {
  queryClient: QueryClient;
  auth: { isAuthenticated: boolean };
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: () => (
    <>
      <Outlet />
      <Toaster position="top-right" richColors />
    </>
  ),
});
