import { createBrowserRouter } from "react-router-dom";

import { AppLayout } from "@/components/layout/app-layout";
import HomePage from "@/pages/home";
import FormsPage from "@/pages/forms";
import MembersPage from "@/pages/members";
import PermissionsLayout from "@/pages/permissions/permissions-layout";
import RolesPage from "@/pages/permissions/roles-page";
import PermissionsCatalogPage from "@/pages/permissions/permissions-page";
import MembersComingSoon from "@/pages/permissions/members-coming-soon";
import OrgMembersPage from "@/pages/permissions/org-members-page";
import SettingsPage from "@/pages/settings";
import LoginPage from "@/pages/login";
import NotFoundPage from "@/pages/not-found";

export const router = createBrowserRouter([
  {
    // Public auth route — rendered outside the app shell (no sidebar).
    path: "/login",
    element: <LoginPage />,
  },
  {
    // Authenticated app shell (sidebar + header). A route guard can be added
    // here later once /auth/me is wired up.
    path: "/",
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "forms", element: <FormsPage /> },
      { path: "members", element: <MembersPage /> },
      {
        path: "permissions",
        element: <PermissionsLayout />,
        children: [
          { index: true, element: <RolesPage /> },
          { path: "permissions", element: <PermissionsCatalogPage /> },
          { path: "members", element: <MembersComingSoon /> },
          { path: "org-members", element: <OrgMembersPage /> },
        ],
      },
      { path: "settings", element: <SettingsPage /> },
    ],
  },
  {
    path: "*",
    element: <NotFoundPage />,
  },
]);
