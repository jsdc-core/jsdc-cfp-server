import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

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
import { listPermissions } from "@/lib/permissions";
import { deleteRole, listRoles } from "@/lib/roles";
import type { Permission } from "@/types/permission";
import {
  ROLE_SCOPES,
  ROLE_SCOPE_LABELS,
  type Role,
  type RoleScope,
} from "@/types/role";

import { ConfirmDialog } from "./confirm-dialog";
import { RoleFormDialog } from "./role-form-dialog";
import { ScopeBadge } from "./scope-badge";

type ScopeFilter = RoleScope | "ALL";

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>("ALL");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [roleList, permList] = await Promise.all([
        listRoles(),
        listPermissions(),
      ]);
      setRoles(roleList);
      setPermissions(permList);
    } catch (err) {
      setError(getApiErrorMessage(err, "載入角色失敗"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const visibleRoles = useMemo(
    () =>
      scopeFilter === "ALL"
        ? roles
        : roles.filter((role) => role.scope === scopeFilter),
    [roles, scopeFilter],
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Scope</span>
          <Select
            value={scopeFilter}
            onValueChange={(value) => setScopeFilter(value as ScopeFilter)}
          >
            <SelectTrigger className="w-36" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">全部</SelectItem>
              {ROLE_SCOPES.map((scope) => (
                <SelectItem key={scope} value={scope}>
                  {ROLE_SCOPE_LABELS[scope]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus />
          新增角色
        </Button>
      </div>

      {error ? (
        <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-40">名稱</TableHead>
              <TableHead className="w-20">Scope</TableHead>
              <TableHead>權限</TableHead>
              <TableHead className="w-24 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-24" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-5 w-12" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-48" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-8 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : visibleRoles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  {roles.length === 0
                    ? "尚無角色，點右上角「新增角色」開始建立。"
                    : "此 scope 目前沒有角色。"}
                </TableCell>
              </TableRow>
            ) : (
              visibleRoles.map((role) => (
                <TableRow key={role.id}>
                  <TableCell className="align-top font-medium">
                    {role.name}
                    {role.description ? (
                      <span className="block text-xs font-normal text-muted-foreground">
                        {role.description}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell className="align-top">
                    <ScopeBadge scope={role.scope} />
                  </TableCell>
                  <TableCell className="align-top">
                    {role.permissions.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {role.permissions.map((rp) => (
                          <Badge
                            key={rp.permission_id}
                            variant="outline"
                            className="font-mono text-xs font-normal"
                          >
                            {rp.permission.code}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(role)}
                        aria-label={`編輯 ${role.name}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(role)}
                        aria-label={`刪除 ${role.name}`}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RoleFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        permissions={permissions}
        role={editing}
        onSaved={load}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="刪除角色"
        description={
          <>
            確定要刪除角色「{deleting?.name}」嗎？擁有此角色的成員 token
            會被撤銷， 此操作無法復原。
          </>
        }
        onConfirm={async () => {
          if (deleting) {
            await deleteRole(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}
