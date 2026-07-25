import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { getApiErrorMessage } from "@/lib/api-error";
import { createPermission, updatePermission } from "@/lib/permissions";
import { PERMISSION_CODE_PATTERN, type Permission } from "@/types/permission";

type PermissionFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this permission; otherwise it creates one. */
  permission?: Permission | null;
  onSaved: () => void;
};

export function PermissionFormDialog({
  open,
  onOpenChange,
  permission,
  onSaved,
}: PermissionFormDialogProps) {
  const isEdit = Boolean(permission);

  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCode(permission?.code ?? "");
    setDescription(permission?.description ?? "");
    setError(null);
    // Re-seed only when opening or switching edit target (not on every keystroke).
  }, [open, permission?.id]);

  async function handleSubmit() {
    const trimmed = code.trim();
    if (!PERMISSION_CODE_PATTERN.test(trimmed)) {
      setError("權限碼格式須為 resource:action，例如 event:edit。");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && permission) {
        await updatePermission(permission.id, {
          code: trimmed,
          description: description.trim() || undefined,
        });
      } else {
        await createPermission({
          code: trimmed,
          description: description.trim() || undefined,
        });
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(getApiErrorMessage(err, "儲存權限失敗"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯權限碼" : "新增權限碼"}</DialogTitle>
          <DialogDescription>
            權限碼採 resource:action 命名，例如 org:profile、event:edit。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="perm-code">權限碼</Label>
            <Input
              id="perm-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="event:edit"
              maxLength={100}
              className="font-mono"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="perm-description">描述（選填）</Label>
            <Textarea
              id="perm-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="這個權限允許的操作…"
              maxLength={255}
              rows={2}
            />
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
            {saving ? "儲存中…" : isEdit ? "儲存變更" : "建立權限碼"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
