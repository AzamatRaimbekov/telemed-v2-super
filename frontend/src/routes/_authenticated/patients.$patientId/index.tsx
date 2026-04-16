import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/patients/$patientId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/patients/$patientId/overview",
      params: { patientId: params.patientId },
    });
  },
});
