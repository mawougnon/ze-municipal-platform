import { afterAll, expect, it, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { runId } from "@/test/database";

const auth = vi.hoisted(() => vi.fn());
vi.mock("@/auth", () => ({ auth }));
vi.mock("@/lib/application-files", () => ({ removeFiles: vi.fn() }));

const { POST } = await import("./route");
const { DELETE } = await import("./[id]/route");

const phone = `0196${runId.slice(-6)}`;
const opportunity = await prisma.opportunity.create({
  data: { type: "TRAINING", title: `Test ${runId}`, description: "Test", published: true },
});

afterAll(async () => {
  await prisma.opportunity.delete({ where: { id: opportunity.id } });
  await prisma.$disconnect();
});

const apply = () =>
  POST(
    new Request("http://localhost/api/candidatures", {
      method: "POST",
      body: JSON.stringify({
        opportunityId: opportunity.id,
        fullName: "Test Hounkpè",
        phone,
        consent: true,
      }),
    }),
  );

it("keeps the limit of 3 applications per number when 6 arrive at the same time", async () => {
  const statuses = (await Promise.all(Array.from({ length: 6 }, apply))).map((r) => r.status);
  expect(statuses.filter((status) => status === 201)).toHaveLength(3);
  expect(statuses.filter((status) => status === 429)).toHaveLength(3);
  expect(await prisma.application.count({ where: { phone } })).toBe(3);
});

it("answers 404 for an application that does not exist", async () => {
  auth.mockResolvedValue({ user: { email: `admin-${runId}@example.test`, role: "ADMIN" } });
  const response = await DELETE(
    new Request("http://localhost/api/candidatures/none", { method: "DELETE" }),
    {
      params: Promise.resolve({ id: `missing-${runId}` }),
    },
  );
  expect(response.status).toBe(404);
});
