import { useCallback, useEffect, useState } from "react";
import { UserCog } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getApiErrorMessage } from "@/lib/api-error";
import { orgMembersApi } from "@/lib/organization-members";
import { listOrganizations } from "@/lib/organizations";
import { listRoleCatalog } from "@/lib/roles";
import type { MemberWithRoles } from "@/types/member";
import type { Organization } from "@/types/organization";
import type { Role } from "@/types/role";

import { OrgMemberRolesDialog } from "./org-member-roles-dialog";

/** First grapheme of a name/email, for the avatar fallback. */
function initial(text: string): string {
  return text.trim().charAt(0).toUpperCase() || "?";
}

export default function OrgMembersPage() {
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [orgId, setOrgId] = useState<string>("");
  const [orgRoles, setOrgRoles] = useState<Role[]>([]);
  const [members, setMembers] = useState<MemberWithRoles[]>([]);

  const [orgsLoading, setOrgsLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<MemberWithRoles | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Load organizations + the ORG-scoped role catalog once on mount. The catalog
  // is the public dev endpoint, so it works without a platform membership.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setOrgsLoading(true);
      setError(null);
      try {
        const [orgList, roleList] = await Promise.all([
          listOrganizations(),
          listRoleCatalog("ORG"),
        ]);
        if (cancelled) return;
        setOrgs(orgList);
        setOrgRoles(roleList);
        if (orgList.length > 0) setOrgId(orgList[0].id);
      } catch (err) {
        if (!cancelled) setError(getApiErrorMessage(err, "載入組織失敗"));
      } finally {
        if (!cancelled) setOrgsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMembers = useCallback(async (id: string) => {
    if (!id) {
      setMembers([]);
      return;
    }
    setMembersLoading(true);
    setError(null);
    try {
      setMembers(await orgMembersApi.listByOrg(id));
    } catch (err) {
      setError(getApiErrorMessage(err, "載入組織成員失敗"));
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers(orgId);
  }, [orgId, loadMembers]);

  function openEdit(member: MemberWithRoles) {
    setEditing(member);
    setDialogOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">組織</span>
        <Select
          value={orgId}
          onValueChange={setOrgId}
          disabled={orgsLoading || orgs.length === 0}
        >
          <SelectTrigger className="w-64" size="sm">
            <SelectValue
              placeholder={orgsLoading ? "載入中…" : "選擇組織"}
            />
          </SelectTrigger>
          <SelectContent>
            {orgs.map((org) => (
              <SelectItem key={org.id} value={org.id}>
                {org.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      {!orgsLoading && orgs.length === 0 ? (
        <div className="rounded-lg border p-10 text-center text-sm text-muted-foreground">
          你目前不屬於任何組織。
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-64">成員</TableHead>
                <TableHead>角色</TableHead>
                <TableHead className="w-28 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {membersLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Skeleton className="size-8 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-40" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="ml-auto h-8 w-20" />
                    </TableCell>
                  </TableRow>
                ))
              ) : members.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={3}
                    className="py-10 text-center text-sm text-muted-foreground"
                  >
                    此組織目前沒有成員。
                  </TableCell>
                </TableRow>
              ) : (
                members.map(({ member, roles }) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-8">
                          {member.avatarUrl ? (
                            <AvatarImage
                              src={member.avatarUrl}
                              alt={member.displayName ?? member.email}
                            />
                          ) : null}
                          <AvatarFallback>
                            {initial(member.displayName ?? member.email)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <div className="truncate font-medium">
                            {member.displayName ?? member.email}
                          </div>
                          {member.displayName ? (
                            <div className="truncate text-xs text-muted-foreground">
                              {member.email}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {roles.length === 0 ? (
                        <span className="text-xs text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {roles.map((role) => (
                            <Badge key={role.id} variant="secondary">
                              {role.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEdit({ member, roles })}
                      >
                        <UserCog />
                        管理角色
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <OrgMemberRolesDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        target={editing}
        orgRoles={orgRoles}
        onSaved={() => loadMembers(orgId)}
      />
    </div>
  );
}
