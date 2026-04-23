import { createFileRoute, redirect } from "@tanstack/react-router";
import { LandingNavbar } from "@/features/landing/components/LandingNavbar";
import { LandingHero } from "@/features/landing/components/LandingHero";
import { LandingPainSolution } from "@/features/landing/components/LandingPainSolution";
import { LandingStats } from "@/features/landing/components/LandingStats";
import { LandingModules } from "@/features/landing/components/LandingModules";
import { LandingBeforeAfter } from "@/features/landing/components/LandingBeforeAfter";
import { LandingCompare } from "@/features/landing/components/LandingCompare";
import { LandingDemo } from "@/features/landing/components/LandingDemo";
import { LandingRoles } from "@/features/landing/components/LandingRoles";
import { LandingPortal } from "@/features/landing/components/LandingPortal";
import { LandingMonitoring } from "@/features/landing/components/LandingMonitoring";
import { LandingSecurity } from "@/features/landing/components/LandingSecurity";
import { LandingIntegrations } from "@/features/landing/components/LandingIntegrations";
import { LandingHowItWorks } from "@/features/landing/components/LandingHowItWorks";
import { LandingSupport } from "@/features/landing/components/LandingSupport";
import { LandingFAQ } from "@/features/landing/components/LandingFAQ";
import { LandingCTA } from "@/features/landing/components/LandingCTA";
import { LandingFooter } from "@/features/landing/components/LandingFooter";

export const Route = createFileRoute("/")({
  beforeLoad: ({ context }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: LandingPage,
});

function LandingPage() {
  return (
    <div className="min-h-screen bg-white text-[#1a1a2e]">
      <LandingNavbar />
      <main>
        <LandingHero />
        <LandingPainSolution />
        <LandingStats />
        <LandingModules />
        <LandingCompare />
        <LandingBeforeAfter />
        <LandingDemo />
        <LandingRoles />
        <LandingPortal />
        <LandingMonitoring />
        <LandingSecurity />
        <LandingIntegrations />
        <LandingHowItWorks />
        <LandingSupport />
        <LandingFAQ />
        <LandingCTA />
      </main>
      <LandingFooter />
    </div>
  );
}
