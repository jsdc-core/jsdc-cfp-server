import { useEffect, useState } from "react";
import { toast } from "sonner";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getApiErrorMessage } from "@/lib/api-error";
import { createMember, updateMember } from "@/lib/members";
import type { Member, MemberStatus } from "@/types/member";

type MemberFormDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When set, the dialog edits this member; otherwise it creates a new one. */
  member?: Member | null;
  /** Called after a successful create/update so the parent can refetch. */
  onSaved: () => void;
};

const STATUSES: MemberStatus[] = ["ACTIVE", "BANNED"];

/** Create / edit member dialog. Reports success and failure via toast. */
export function MemberFormDialog({
  open,
  onOpenChange,
  member,
  onSaved,
}: MemberFormDialogProps) {
  const isEdit = Boolean(member);

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [location, setLocation] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [status, setStatus] = useState<MemberStatus>("ACTIVE");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Re-seed the form whenever the dialog opens or the edit target changes.
  useEffect(() => {
    if (!open) return;
    setEmail(member?.email ?? "");
    setDisplayName(member?.displayName ?? "");
    setLocation(member?.location ?? "");
    setJobTitle(member?.jobTitle ?? "");
    setStatus(member?.status ?? "ACTIVE");
    setError(null);
  }, [open, member?.id]);

  async function handleSubmit() {
    if (!isEdit && !email.trim()) {
      setError("Email 為必填");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      if (isEdit && member) {
        await updateMember(member.id, {
          displayName: displayName.trim() || undefined,
          location: location.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          status,
        });
        toast.success(`已更新成員「${member.email}」`);
      } else {
        const created = await createMember({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          location: location.trim() || undefined,
          jobTitle: jobTitle.trim() || undefined,
          status,
        });
        toast.success(`已新增成員「${created.email}」`);
      }
      onSaved();
      onOpenChange(false);
    } catch (err) {
      const message = getApiErrorMessage(err, "儲存成員失敗");
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "編輯成員" : "新增成員"}</DialogTitle>
          <DialogDescription>設定成員的基本資料與帳號狀態。</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="member-email">Email</Label>
            <Input
              id="member-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@example.com"
              disabled={isEdit}
            />
            {isEdit ? (
              <p className="text-xs text-muted-foreground">
                Email 建立後不可變更。
              </p>
            ) : null}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-display-name">顯示名稱（選填）</Label>
            <Input
              id="member-display-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="王小明"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-location">所在地（選填）</Label>
            <Input
              id="member-location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Taipei, Taiwan"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-job-title">職稱（選填）</Label>
            <Input
              id="member-job-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              placeholder="Software Engineer"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="member-status">狀態</Label>
            <Select
              value={status}
              onValueChange={(value) => setStatus(value as MemberStatus)}
            >
              <SelectTrigger id="member-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            {saving ? "儲存中…" : isEdit ? "儲存變更" : "建立成員"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
