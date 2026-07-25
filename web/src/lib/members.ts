import { api } from "./api";
import type { CreateMemberDto, Member, UpdateMemberDto } from "@/types/member";

/**
 * Member CRUD. Backend routes live under `/members` and require the platform
 * `org:member:manage` permission.
 */

export async function listMembers(): Promise<Member[]> {
  const { data } = await api.get<Member[]>("/members");
  return data;
}

export async function getMember(id: string): Promise<Member> {
  const { data } = await api.get<Member>(`/members/${id}`);
  return data;
}

export async function createMember(dto: CreateMemberDto): Promise<Member> {
  const { data } = await api.post<Member>("/members", dto);
  return data;
}

export async function updateMember(
  id: string,
  dto: UpdateMemberDto,
): Promise<Member> {
  const { data } = await api.patch<Member>(`/members/${id}`, dto);
  return data;
}

export async function deleteMember(id: string): Promise<void> {
  await api.delete(`/members/${id}`);
}
