import { PrismaClient } from "../generated/prisma/client";
import { RoleScope } from "../generated/prisma/enums";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { withId } from "src/common/utils/db.util";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// --- Scoped permission catalogue (KKTIX-style) ---
const PLATFORM_PERMISSIONS = [
  "activity:manage",
  "permission:manage",
  "role:manage",
];

const ORG_PERMISSIONS = [
  "org:profile", // edit organization info
  "org:finance", // financial reports & settings
  "org:member:manage", // invite members, edit roles (KKTIX「權限管理」)
  "org:report", // activity reports
];

const EVENT_PERMISSIONS = [
  "event:edit", // edit the activity
  "event:registration:read", // view/export full registration data
  "event:checkin", // check-in only (limited registration view)
  "event:order:manage", // ticket orders
  "event:report", // sales status / reports
  "event:venue", // venue & seating
  "event:member:manage", // invite activity members, edit roles
];

const ALL_PERMISSION_CODES = [
  ...PLATFORM_PERMISSIONS,
  ...ORG_PERMISSIONS,
  ...EVENT_PERMISSIONS,
];

// --- Default roles per scope (KKTIX presets) ---
interface RoleSeed {
  name: string;
  scope: RoleScope;
  description: string;
  permissions: string[];
}

const ROLE_SEEDS: RoleSeed[] = [
  {
    name: "admin",
    scope: RoleScope.PLATFORM,
    description: "Platform administrator",
    permissions: PLATFORM_PERMISSIONS,
  },
  {
    name: "Owner",
    scope: RoleScope.ORG,
    description: "Organization owner (all org permissions)",
    permissions: ORG_PERMISSIONS,
  },
  {
    name: "Admin",
    scope: RoleScope.ORG,
    description: "Organization admin (all org permissions)",
    permissions: ORG_PERMISSIONS,
  },
  {
    name: "Accountant",
    scope: RoleScope.ORG,
    description: "Organization accountant (finance & reports)",
    permissions: ["org:finance", "org:report"],
  },
  {
    name: "Admin",
    scope: RoleScope.EVENT,
    description: "Activity admin (all activity permissions)",
    permissions: EVENT_PERMISSIONS,
  },
  {
    name: "Creator",
    scope: RoleScope.EVENT,
    description: "Activity creator",
    permissions: [
      "event:edit",
      "event:registration:read",
      "event:order:manage",
      "event:report",
      "event:venue",
    ],
  },
  {
    name: "Accountant",
    scope: RoleScope.EVENT,
    description: "Activity accountant (orders & reports)",
    permissions: ["event:order:manage", "event:report"],
  },
  {
    name: "Checkin",
    scope: RoleScope.EVENT,
    description: "Check-in staff (limited registration view)",
    permissions: ["event:checkin"],
  },
  {
    name: "Streaming",
    scope: RoleScope.EVENT,
    description: "Streaming producer",
    permissions: ["event:edit"],
  },
];

async function main() {
  // 1. Permissions
  const permissions = await Promise.all(
    ALL_PERMISSION_CODES.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: withId({
          code,
          description: `${code.replace(/:/g, " ")} permission`,
        }),
      }),
    ),
  );
  const byCode = new Map(permissions.map((p) => [p.code, p.id]));
  console.log(`Seeded ${permissions.length} permissions.`);

  // 2. Roles (+ sync their permissions)
  for (const seed of ROLE_SEEDS) {
    const role = await prisma.role.upsert({
      where: { name_scope: { name: seed.name, scope: seed.scope } },
      update: { description: seed.description },
      create: withId({
        name: seed.name,
        scope: seed.scope,
        description: seed.description,
      }),
    });

    await prisma.rolePermission.deleteMany({ where: { role_id: role.id } });
    await prisma.rolePermission.createMany({
      data: seed.permissions.map((code) => ({
        role_id: role.id,
        permission_id: byCode.get(code)!,
      })),
    });
    console.log(
      `Seeded role ${seed.scope}/${seed.name} with ${seed.permissions.length} permissions.`,
    );
  }

  console.log("Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
