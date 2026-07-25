/**
 * An organization. Mirrors the backend `Organization` Prisma model.
 * `GET /organizations` returns the orgs the current member belongs to.
 */
export type Organization = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  createdAt: string;
  updatedAt: string;
};
