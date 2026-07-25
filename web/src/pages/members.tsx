import { useCallback, useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
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
import { deleteMember, listMembers } from "@/lib/members";
import type { Member } from "@/types/member";

import { ConfirmDialog } from "./permissions/confirm-dialog";
import { MemberFormDialog } from "./member-form-dialog";

const COLUMN_COUNT = 7;

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Member | null>(null);
  const [deleting, setDeleting] = useState<Member | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMembers(await listMembers());
    } catch (err) {
      setError(getApiErrorMessage(err, "載入成員失敗"));
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

  function openEdit(member: Member) {
    setEditing(member);
    setFormOpen(true);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">成員管理</h1>
          <p className="text-sm text-muted-foreground">
            管理平台成員的基本資料與帳號狀態。
          </p>
        </div>
        <Button onClick={openCreate} size="sm">
          <Plus />
          新增成員
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
              <TableHead>Email</TableHead>
              <TableHead className="w-40">顯示名稱</TableHead>
              <TableHead className="w-36">所在地</TableHead>
              <TableHead className="w-40">職稱</TableHead>
              <TableHead className="w-24">狀態</TableHead>
              <TableHead className="w-28">建立時間</TableHead>
              <TableHead className="w-24 text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: COLUMN_COUNT }).map((__, j) => (
                    <TableCell key={j}>
                      <Skeleton
                        className={
                          j === COLUMN_COUNT - 1
                            ? "ml-auto h-8 w-16"
                            : "h-4 w-full max-w-32"
                        }
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : members.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={COLUMN_COUNT}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  尚無成員，點右上角「新增成員」開始建立。
                </TableCell>
              </TableRow>
            ) : (
              members.map((member) => (
                <TableRow key={member.id}>
                  <TableCell className="font-medium">{member.email}</TableCell>
                  <TableCell>
                    {member.displayName ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.location ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {member.jobTitle ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        member.status === "ACTIVE" ? "default" : "destructive"
                      }
                      className={
                        member.status === "ACTIVE"
                          ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                          : undefined
                      }
                    >
                      {member.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(member.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openEdit(member)}
                        aria-label={`編輯 ${member.email}`}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleting(member)}
                        aria-label={`刪除 ${member.email}`}
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

      <MemberFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        member={editing}
        onSaved={load}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title="刪除成員"
        description={
          <>確定要刪除成員「{deleting?.email}」嗎？此操作無法復原。</>
        }
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteMember(deleting.id);
          } catch (err) {
            toast.error(getApiErrorMessage(err, "刪除成員失敗"));
            throw err;
          }
          toast.success(`已刪除成員「${deleting.email}」`);
          setDeleting(null);
          await load();
        }}
      />
    </div>
  );
}
