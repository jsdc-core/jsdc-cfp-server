import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

type PermissionTab = {
  value: string;
  label: string;
  /** Absolute path this tab routes to. */
  path: string;
};

const TABS: PermissionTab[] = [
  { value: "roles", label: "角色", path: "/permissions" },
  { value: "permissions", label: "權限碼", path: "/permissions/permissions" },
  { value: "members", label: "成員", path: "/permissions/members" },
  { value: "org-members", label: "組織成員", path: "/permissions/org-members" },
];

/**
 * Shell for the permission-management section. Renders a tab bar that drives
 * the nested routes (角色 / 權限碼 / 成員) and an <Outlet /> for the active page.
 */
export default function PermissionsLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  // Longest matching path wins so /permissions/permissions doesn't also light
  // up the index (/permissions) tab.
  const active =
    [...TABS]
      .filter(
        (tab) => pathname === tab.path || pathname.startsWith(tab.path + "/"),
      )
      .sort((a, b) => b.path.length - a.path.length)[0]?.value ?? "roles";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">權限管理</h2>
        <p className="text-sm text-muted-foreground">
          管理角色 (Role)、權限碼 (event:edit、org:member:manage…) 與成員指派。
        </p>
      </div>

      <Tabs
        value={active}
        onValueChange={(value) => {
          const tab = TABS.find((t) => t.value === value);
          if (tab) navigate(tab.path);
        }}
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Outlet />
    </div>
  );
}
