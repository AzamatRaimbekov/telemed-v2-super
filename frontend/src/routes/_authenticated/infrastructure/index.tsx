import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/infrastructure/")({
  beforeLoad: () => {
    throw redirect({ to: "/infrastructure/dashboard" });
  },
});
