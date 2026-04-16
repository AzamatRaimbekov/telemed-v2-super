import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_authenticated/patients/$patientId/history"
)({
  component: HistoryLayout,
});

function HistoryLayout() {
  return <Outlet />;
}
