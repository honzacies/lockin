import { createInterface } from "node:readline/promises";
import { PrismaClient } from "@prisma/client";
import { HashPassword } from "../Lib/Password.js";
import { GenerateInviteCode } from "../Lib/Tokens.js";

/**
 * Bootstrap prvního admina. Registrace přes API vyžaduje invite kód a ten
 * nemá kdo vydat, dokud neexistuje admin — tenhle skript ten kruh přetne.
 *
 * Spouští se ručně: `bun run seed:admin`.
 */

const prisma = new PrismaClient();

async function Main(): Promise<void> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });

  const existingAdmin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (existingAdmin) {
    console.log(`An admin already exists: ${existingAdmin.username}`);
    const answer = await rl.question("Create another one? [y/N] ");
    if (answer.toLowerCase() !== "y") {
      rl.close();
      await prisma.$disconnect();
      return;
    }
  }

  const username = (await rl.question("Username: ")).trim();
  const password = (await rl.question("Password (8 characters min): ")).trim();
  rl.close();

  if (username.length < 3 || password.length < 8) {
    console.error("Username needs 3+ characters and password 8+.");
    process.exit(1);
  }

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) {
    console.error("That username is taken.");
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: { username, passwordHash: await HashPassword(password), role: "ADMIN" },
  });

  // Rovnou i první invite kód, ať je s čím začít.
  const code = GenerateInviteCode();
  await prisma.inviteCode.create({ data: { code, note: "first code from seed" } });

  console.log(`\nAdmin ${user.username} created.`);
  console.log(`First invite code: ${code}\n`);

  await prisma.$disconnect();
}

Main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
