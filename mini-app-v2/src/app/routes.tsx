import { Routes, Route } from "react-router-dom";
import { lazy, Suspense } from "react";

const DashboardPage = lazy(() => import("@/features/dashboard/DashboardPage").then(m => ({ default: m.DashboardPage })));
const ObjectPage = lazy(() => import("@/features/object/ObjectPage").then(m => ({ default: m.ObjectPage })));
const NotificationCenter = lazy(() => import("@/features/notifications/NotificationCenter").then(m => ({ default: m.NotificationCenter })));
const ProfilePage = lazy(() => import("@/features/profile/ProfilePage").then(m => ({ default: m.ProfilePage })));

const Loader = () => (
  <div className="flex items-center justify-center py-16">
    <div className="w-6 h-6 border-2 border-tg-button border-t-transparent rounded-full animate-spin" />
  </div>
);

export function AppRoutes() {
  return (
    <div className="pb-safe">
      <Suspense fallback={<Loader />}>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/object/:id/*" element={<ObjectPage />} />
          <Route path="/notifications" element={<NotificationCenter />} />
          <Route path="/profile/*" element={<ProfilePage />} />
        </Routes>
      </Suspense>
    </div>
  );
}
