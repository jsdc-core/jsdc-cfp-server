import { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import { createRole, updateRole } from "@/lib/roles";
import type { Permission } from "@/types/permission";
import {
  ROLE_SCOPES,
  ROLE_SCOPE_LABELS,
  type Role,
  type RoleScope,
} from "@/types/role";

type RoleFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** All permissions available to attach; rendered as grouped checkboxes. */
  permissions: Permission[];
  /** When set, the dialog edits this role; otherwise it creates a new one. */
  role?: Role | null;
  /** Called after a successful create/update so the parent can refetch. */
  onSaved: () => void;
};

/** Group permissions by their resource prefix (the part before the colon). */
function groupByResource(permissions: Permission[]): [string, Permission[]][] {
  const groups = new Map<string, Permission[]>();
  for (const perm of permissions) {
    const resource = perm.code.split(":")[0] ?? "other";
    const list = groups.get(resource) ?? [];
    list.push(perm);
    groups.set(resource, list);
  }
  return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
}

export function RoleFormDialog({
  open,
  onOpenChange,
  permissions,
  role,
  onSaved,
}: RoleFormDialogProps) {
  const isEdit = Boolean(role);

  const [name, setName] = useState("");
  const [scope, setScope] = useState<RoleScope>("PLATFORM");
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset the form whenever the dialog opens (for a fresh create or a new edit
  // target). Depends on `role?.id` so switching edit targets re-seeds fields.
  useEffect(() => {
    if (!open) return;
    setName(role?.name ?? "");
    setScope(role?.scope ?? "PLATFORM");
    setDescription(role?.description ?? "");
    setSelectedIds(
      new Set(role?.permissions.map((p) => p.permission_id) ?? []),
    );
    setError(null);
    // Re-seed only when opening or switching edit target (not on every keystroke).
  }, [open, role?.id]);

  const grouped = useMemo(() => groupByResource(permissions), [permissions]);

  function togglePermission(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!name.trim()) {
      setError("角色名稱為必填");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const permissionIds = [...selectedIds];
      if (isEdit && role) {
        await updateRole(role.id, {
          name: name.trim(),
          description: description.trim() || undefined,
          permissionIds,
        });
      } else {
        await createRole({
          name: name.trim(),
          scope,
          description: description.trim() || undefined,
          permissionIds,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "儲存角色失敗"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯角色" : "新增角色"}</DialogTitle>
          <DialogDescription>
            設定角色名稱、scope 與要授予的權限碼。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="role-name">名稱</Label>
            <Input
              id="role-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="editor"
              maxLength={50}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-scope">Scope</Label>
            <Select
              value={scope}
              onValueChange={(value) => setScope(value as RoleScope)}
              disabled={isEdit}
            >
              <SelectTrigger id="role-scope" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_SCOPES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {ROLE_SCOPE_LABELS[s]}（{s}）
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isEdit ? (
              <p className="text-xs text-muted-foreground">
                Scope 建立後不可變更。
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="role-description">描述（選填）</Label>
            <Textarea
              id="role-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="這個角色的用途…"
              maxLength={255}
              rows={2}
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label>權限（{selectedIds.size} 已選）</Label>
            </div>
            {permissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                尚無可用的權限碼，請先到「權限碼」頁面新增。
              </p>
            ) : (
              <div className="max-h-64 space-y-4 overflow-y-auto rounded-lg border p-3">
                {grouped.map(([resource, perms]) => (
                  <div key={resource} className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">
                      {resource}
                    </p>
                    <div className="grid gap-2">
                      {perms.map((perm) => (
                        <label
                          key={perm.id}
                          className="flex items-start gap-2 text-sm"
                        >
                          <Checkbox
                            checked={selectedIds.has(perm.id)}
                            onCheckedChange={(checked) =>
                              togglePermission(perm.id, checked === true)
                            }
                            className="mt-0.5"
                          />
                          <span>
                            <code className="font-mono text-xs">
                              {perm.code}
                            </code>
                            {perm.description ? (
                              <span className="block text-xs text-muted-foreground">
                                {perm.description}
                              </span>
                            ) : null}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? "儲存中…" : isEdit ? "儲存變更" : "建立角色"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
