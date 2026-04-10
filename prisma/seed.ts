import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("changeme123", 12);

  const user = await prisma.user.upsert({
    where: { email: "felix.lindenmann@vertify.ch" },
    update: {},
    create: {
      email: "felix.lindenmann@vertify.ch",
      username: "felix.lindenmann",
      firstName: "Felix",
      lastName: "Lindenmann",
      passwordHash,
      mustChangePassword: true,
    },
  });

  console.log(`✓ User erstellt: ${user.email} (ID: ${user.id})`);
  console.log(`  Temporäres Passwort: changeme123`);
  console.log(`  mustChangePassword: ${user.mustChangePassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
