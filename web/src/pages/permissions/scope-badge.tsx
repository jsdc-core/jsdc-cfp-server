import { Badge } from "@/components/ui/badge";
import { ROLE_SCOPE_LABELS, type RoleScope } from "@/types/role";

const SCOPE_VARIANT: Record<
  RoleScope,
  React.ComponentProps<typeof Badge>["variant"]
> = {
  PLATFORM: "default",
  ORG: "secondary",
  EVENT: "outline",
};

/** Colored badge rendering a permission scope (PLATFORM / ORG / EVENT). */
export function ScopeBadge({ scope }: { scope: RoleScope }) {
  return (
    <Badge variant={SCOPE_VARIANT[scope]}>{ROLE_SCOPE_LABELS[scope]}</Badge>
  );
}
