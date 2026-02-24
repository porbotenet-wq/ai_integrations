// src/components/DashboardRouter.tsx
import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { detectPrimaryRole, isForeman } from "@/lib/detectPrimaryRole";

const Dashboard = lazy(() => import("@/components/Dashboard"));
const DirectorDashboard = lazy(() => import("@/components/DirectorDashboard"));
const PMDashboard = lazy(() => import("@/components/PMDashboard"));
const ForemanDashboard = lazy(() => import("@/components/ForemanDashboard"));
const SupplyDashboard = lazy(() => import("@/components/SupplyDashboard"));
const PTODashboard = lazy(() => import("@/components/PTODashboard"));
const InspectorDashboard = lazy(() => import("@/components/InspectorDashboard"));

const Fallback = () => (
  <div className="flex items-center justify-center py-12">
    <div className="w-6 h-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
  </div>
);

interface Props {
  projectId: string;
}

const DashboardRouter = ({ projectId }: Props) => {
  const { roles } = useAuth();
  const primary = detectPrimaryRole(roles);

  const renderDashboard = () => {
    switch (primary) {
      case "director":
        return <DirectorDashboard projectId={projectId} />;
      case "pm":
        return <PMDashboard projectId={projectId} />;
      case "supply":
        return <SupplyDashboard projectId={projectId} />;
      case "pto":
        return <PTODashboard projectId={projectId} />;
      case "inspector":
        return <InspectorDashboard projectId={projectId} />;
      default:
        if (isForeman(primary)) {
          return <ForemanDashboard projectId={projectId} />;
        }
        return <Dashboard projectId={projectId} />;
    }
  };

  return (
    <Suspense fallback={<Fallback />}>
      {renderDashboard()}
    </Suspense>
  );
};

export default DashboardRouter;
