import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { deletePermission, listPermissions } from "@/lib/permissions";
import type { Permission } from "@/types/permission";

import { ConfirmDialog } from "./confirm-dialog";
import { PermissionFormDialog } from "./permission-form-dialog";

export default function PermissionsCatalogPage() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Permission | null>(null);
  const [deleting, setDeleting] = useState<Permission | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setPermissions(await listPermissions());
    } catch (err) {
      setError(getApiErrorMessage(err, "載入權限碼失敗"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(permission: Permission) {
    setEditing(permission);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          全平台可指派給角色的權限碼。
        </p>
        <Button onClick={openCreate} size="sm">
          <Plus />
          新增權限碼
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
              <TableHead className="w-64">權限碼</TableHead>
              <TableHead>描述</TableHead>
              <TableHead className="w-24 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <Skeleton className="h-4 w-40" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="h-4 w-56" />
                  </TableCell>
                  <TableCell>
                    <Skeleton className="ml-auto h-8 w-16" />
                  </TableCell>
                </TableRow>
              ))
            ) : permissions.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={3}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  尚無權限碼，點右上角「新增權限碼」開始建立。
                </TableCell>
              </TableRow>
            ) : (
              permissions.map((perm) => (
                <TableRow key={perm.id}>
                  <TableCell>
                    <code className="font-mono text-sm">{perm.code}</code>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {perm.description || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(perm)}
                        aria-label={`編輯 ${perm.code}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(perm)}
                        aria-label={`刪除 ${perm.code}`}
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

      <PermissionFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        permission={editing}
        onSaved={load}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="刪除權限碼"
        description={
          <>
            確定要刪除權限碼「{deleting?.code}」嗎？擁有此權限的角色成員 token
            會被撤銷，此操作無法復原。
          </>
        }
        onConfirm={async () => {
          if (deleting) {
            await deletePermission(deleting.id);
            setDeleting(null);
            await load();
          }
        }}
      />
    </div>
  );
}
