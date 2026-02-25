import { PrismaClient } from "../generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { withId } from "src/common/utils/db.util";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const permissionCodes = [
    "activity:create",
    "activity:edit",
    "activity:delete",
    "activity:view",
  ];

  const permissions = await Promise.all(
    permissionCodes.map((code) =>
      prisma.permission.upsert({
        where: { code },
        update: {},
        create: withId({
          code,
          description: `${code.replace(":", " ")} permission`,
        }),
      }),
    ),
  );

  console.log(`Created ${permissions.length} permissions.`);

  // Create admin role with all permissions
  await prisma.role.upsert({
    where: { name: "admin" },
    update: {},
    create: withId({
      name: "admin",
      description: "admin",
      permissions: {
        create: permissions.map((p) => ({
          permission_id: p.id,
        })),
      },
    }),
  });

  console.log("Admin role seeded with all permissions.");

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
