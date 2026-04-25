import { Routes, Route } from "react-router";
import { lazy, Suspense } from "react";
import LoadingScreen from "@/components/loading-screen";

const Dashboard = lazy(() => import("@/app/dashboard"));
const Members = lazy(() => import("@/app/members/page"));
const Policies = lazy(() => import("@/app/policies/page"));
const PolicyDetail = lazy(() => import("@/app/policies/[id]/page"));
const Insurers = lazy(() => import("@/app/insurers/page"));
const Assets = lazy(() => import("@/app/assets/page"));
const Hospitals = lazy(() => import("@/app/hospitals/page"));
const Doctors = lazy(() => import("@/app/doctors/page"));
const MedicalVisits = lazy(() => import("@/app/medical-visits/page"));
const CoverageLookup = lazy(() => import("@/app/coverage-lookup/page"));
const RenewalCalendar = lazy(() => import("@/app/renewal-calendar/page"));
const Settings = lazy(() => import("@/app/settings/page"));
const Cli = lazy(() => import("@/app/cli/page"));

export function App() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/members" element={<Members />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/policies/:id" element={<PolicyDetail />} />
        <Route path="/insurers" element={<Insurers />} />
        <Route path="/assets" element={<Assets />} />
        <Route path="/hospitals" element={<Hospitals />} />
        <Route path="/doctors" element={<Doctors />} />
        <Route path="/medical-visits" element={<MedicalVisits />} />
        <Route path="/coverage-lookup" element={<CoverageLookup />} />
        <Route path="/renewal-calendar" element={<RenewalCalendar />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/cli" element={<Cli />} />
      </Routes>
    </Suspense>
  );
}
