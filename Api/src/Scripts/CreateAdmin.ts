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
    console.log(`Admin už existuje: ${existingAdmin.username}`);
    const answer = await rl.question("Založit dalšího? [a/N] ");
    if (answer.toLowerCase() !== "a") {
      rl.close();
      await prisma.$disconnect();
      return;
    }
  }

  const username = (await rl.question("Uživatelské jméno: ")).trim();
  const password = (await rl.question("Heslo (min. 8 znaků): ")).trim();
  rl.close();

  if (username.length < 3 || password.length < 8) {
    console.error("Jméno musí mít aspoň 3 znaky a heslo aspoň 8.");
    process.exit(1);
  }

  const taken = await prisma.user.findUnique({ where: { username } });
  if (taken) {
    console.error("Tohle jméno je už obsazené.");
    process.exit(1);
  }

  const user = await prisma.user.create({
    data: { username, passwordHash: await HashPassword(password), role: "ADMIN" },
  });

  // Rovnou i první invite kód, ať je s čím začít.
  const code = GenerateInviteCode();
  await prisma.inviteCode.create({ data: { code, note: "první kód ze seedu" } });

  console.log(`\nAdmin ${user.username} založen.`);
  console.log(`První invite kód: ${code}\n`);

  await prisma.$disconnect();
}

Main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
