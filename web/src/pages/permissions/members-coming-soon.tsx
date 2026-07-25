import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Placeholder for the upcoming member role-assignment UI (預留). */
export default function MembersComingSoon() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">成員角色指派（開發中）</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        將支援為成員在 PLATFORM / ORG / EVENT scope 指派角色 （PUT
        /organizations/:orgId/members/:memberId/roles）。類型與 API
        服務層已預留於 <code className="font-mono">src/types/member.ts</code> 與{" "}
        <code className="font-mono">src/lib/organizations.ts</code>。
      </CardContent>
    </Card>
  );
}
