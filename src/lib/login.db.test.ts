import bcrypt from "bcrypt";
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runId } from "@/test/database";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

const { MAX_ATTEMPTS, MAX_DAILY_FAILURES, requestLoginCode, verifyLoginCode } =
  await import("@/lib/login");

const email = `login-${runId}@example.test`;
const failures = () =>
  prisma.auditLog.count({ where: { userEmail: email, action: "LOGIN_OTP_FAILED" } });

beforeEach(async () => {
  send.mockResolvedValue({ data: { id: "mail" }, error: null });
  await prisma.auditLog.deleteMany({ where: { userEmail: email } });
  await prisma.user.upsert({
    where: { email },
    create: { email },
    update: {},
  });
  await prisma.user.update({
    where: { email },
    data: {
      otpHash: await bcrypt.hash("123456", 4),
      otpExpires: new Date(Date.now() + 60_000),
      otpAttempts: 0,
    },
  });
});

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { userEmail: email } });
  await prisma.user.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

it("checks at most 5 guesses of one code even when 20 arrive at the same time", async () => {
  const guesses = Array.from({ length: 20 }, (_, i) => String(200000 + i));
  await Promise.all(guesses.map((guess) => verifyLoginCode(email, guess, null)));
  expect(await failures()).toBe(MAX_ATTEMPTS);
});

it("suspends the account for a day at the daily limit and alerts its owner", async () => {
  await prisma.auditLog.createMany({
    data: Array.from({ length: MAX_DAILY_FAILURES - 1 }, () => ({
      action: "LOGIN_OTP_FAILED",
      userEmail: email,
    })),
  });

  expect(await verifyLoginCode(email, "000000", null)).toBeNull();
  expect(send).toHaveBeenCalledTimes(1);
  expect(await verifyLoginCode(email, "123456", null)).toBeNull();

  const before = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.user.update({ where: { email }, data: { otpExpires: null } });
  await requestLoginCode(email, null);
  const after = await prisma.user.findUniqueOrThrow({ where: { email } });
  expect(after.otpHash).toBe(before.otpHash);
  expect(send).toHaveBeenCalledTimes(1);
});
