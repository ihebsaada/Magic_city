import prisma from "../src/prisma";
import bcrypt from "bcrypt";

async function main() {
  const email = process.env.ADMIN_EMAIL!;
  const password = process.env.ADMIN_PASSWORD!;
  if (!email || !password)
    throw new Error("Missing ADMIN_EMAIL / ADMIN_PASSWORD");

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    console.log("Admin already exists:", email);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.create({ data: { email, passwordHash } });
  console.log("✅ Admin created:", email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
