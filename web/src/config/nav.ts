import {
  LayoutDashboard,
  FileText,
  Users,
  ShieldCheck,
  Settings,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Only match when the path is exactly `url` (used for the index route). */
  end?: boolean;
};

/**
 * Primary sidebar navigation. Routes are placeholders for now — each maps to a
 * page under src/pages. Permission-scoped visibility (PLATFORM/ORG/EVENT RBAC)
 * can be layered on later once the auth/me endpoint is wired up.
 */
export const navItems: NavItem[] = [
  { title: "首頁", url: "/", icon: LayoutDashboard, end: true },
  { title: "表單管理", url: "/forms", icon: FileText },
  { title: "成員管理", url: "/members", icon: Users },
  { title: "權限管理", url: "/permissions", icon: ShieldCheck },
  { title: "個人設定", url: "/settings", icon: Settings },
];
