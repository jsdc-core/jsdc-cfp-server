import { useEffect, useState } from "react";

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
import { getApiErrorMessage } from "@/lib/api-error";
import { orgMembersApi } from "@/lib/organization-members";
import type { MemberWithRoles } from "@/types/member";
import type { Role } from "@/types/role";

type OrgMemberRolesDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The organization whose roles are being assigned. */
  orgId: string;
  /** The member being edited (null when the dialog is closed). */
  target: MemberWithRoles | null;
  /** ORG-scoped roles available to assign in this organization. */
  orgRoles: Role[];
  /** Called after a successful save so the parent can refetch the list. */
  onSaved: () => void;
};

/**
 * Dialog for replacing a member's ORG-scoped roles. Renders one checkbox per
 * available ORG role, pre-checked from the member's current roles, and PUTs the
 * full selected set on save.
 */
export function OrgMemberRolesDialog({
  open,
  onOpenChange,
  orgId,
  target,
  orgRoles,
  onSaved,
}: OrgMemberRolesDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the checkboxes from the member's current roles whenever the dialog
  // opens or the edit target changes.
  useEffect(() => {
    if (!open) return;
    setSelectedIds(new Set(target?.roles.map((r) => r.id) ?? []));
    setError(null);
  }, [open, target?.member.id]);

  function toggle(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function handleSubmit() {
    if (!target) return;
    setSaving(true);
    setError(null);
    try {
      await orgMembersApi.updateRoles(orgId, target.member.id, [
        ...selectedIds,
      ]);
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "儲存角色失敗"));
    } finally {
      setSaving(false);
    }
  }

  const memberLabel =
    target?.member.displayName ?? target?.member.email ?? "成員";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>管理角色</DialogTitle>
          <DialogDescription>
            為「{memberLabel}」勾選此組織 (ORG) 適用的角色。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          {orgRoles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              尚無 ORG scope 的角色，請先到「角色」頁面建立。
            </p>
          ) : (
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border p-3">
              {orgRoles.map((role) => (
                <label
                  key={role.id}
                  className="flex items-start gap-2 text-sm"
                >
                  <Checkbox
                    checked={selectedIds.has(role.id)}
                    onCheckedChange={(checked) =>
                      toggle(role.id, checked === true)
                    }
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-medium">{role.name}</span>
                    {role.description ? (
                      <span className="block text-xs text-muted-foreground">
                        {role.description}
                      </span>
                    ) : null}
                  </span>
                </label>
              ))}
            </div>
          )}

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
          <Button
            onClick={handleSubmit}
            disabled={saving || orgRoles.length === 0}
          >
            {saving ? "儲存中…" : "儲存"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
