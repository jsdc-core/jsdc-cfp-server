import { api } from "./api";
import type {
  CreatePermissionDto,
  Permission,
  UpdatePermissionDto,
} from "@/types/permission";

/**
 * Permission CRUD. Backend routes live under `/permissions` and require the
 * platform `permission:manage` permission.
 */

export async function listPermissions(): Promise<Permission[]> {
  const { data } = await api.get<Permission[]>("/permissions");
  return data;
}

export async function createPermission(
  dto: CreatePermissionDto,
): Promise<Permission> {
  const { data } = await api.post<Permission>("/permissions", dto);
  return data;
}

export async function updatePermission(
  id: string,
  dto: UpdatePermissionDto,
): Promise<Permission> {
  const { data } = await api.patch<Permission>(`/permissions/${id}`, dto);
  return data;
}

export async function deletePermission(id: string): Promise<void> {
  await api.delete(`/permissions/${id}`);
}
