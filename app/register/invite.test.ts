import { describe, expect, it, vi } from "vitest";
import type { ReactElement, ReactNode } from "react";

// A team invite works only with the email it was made for. The sign-up
// page must not print that email: whoever holds a forwarded or leaked link
// would otherwise get both halves of the key.

vi.mock("next/navigation", () => ({ redirect: () => { throw new Error("NEXT_REDIRECT"); } }));
vi.mock("@/lib/auth/session", () => ({ getSessionOperator: async () => null }));
vi.mock("@/lib/i18n/locale", () => ({ getLocale: async () => "ka" }));
vi.mock("@/lib/db", () => ({
  prisma: {
    invite: {
      findUnique: async () => ({ email: "nino@company.ge", usedAt: null, createdAt: new Date() }),
    },
  },
}));
const AuthFormStub = vi.hoisted(() => function AuthForm() { return null; });
vi.mock("../login/auth-form", () => ({ default: AuthFormStub }));
vi.mock("../legal-doc", () => ({ LegalNote: () => null }));

import RegisterPage from "./page";

function find(node: ReactNode, type: unknown): ReactElement | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = find(child, type);
      if (hit) return hit;
    }
    return null;
  }
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (element.type === type) return element;
  return find(element.props?.children, type);
}

describe("the sign-up page for an invite", () => {
  it("does not print the invited email", async () => {
    const page = await RegisterPage({ searchParams: Promise.resolve({ invite: "tok" }) });
    const form = find(page, AuthFormStub) as ReactElement<{ inviteEmail?: string; invite?: string }> | null;
    expect(form).not.toBeNull();
    expect(form!.props.invite).toBe("tok");
    expect(form!.props.inviteEmail).toBeUndefined();
    expect(JSON.stringify(page)).not.toContain("nino@company.ge");
  });
});
