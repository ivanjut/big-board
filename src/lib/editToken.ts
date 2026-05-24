import crypto from "crypto";
import { cookies } from "next/headers";

// A draft is "unlocked" for editing by setting a signed, httpOnly cookie after
// the correct password is supplied. The cookie value is an HMAC of the draft id,
// so it cannot be forged without the server secret.

const secret = () => process.env.EDIT_TOKEN_SECRET || "dev-insecure-secret";

export function sign(draftId: string): string {
  return crypto.createHmac("sha256", secret()).update(draftId).digest("hex");
}

export function cookieName(draftId: string): string {
  return `ffedit_${draftId}`;
}

export async function setEditCookie(draftId: string): Promise<void> {
  const jar = await cookies();
  jar.set(cookieName(draftId), sign(draftId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 1 week
  });
}

export async function canEdit(draftId: string): Promise<boolean> {
  const jar = await cookies();
  const value = jar.get(cookieName(draftId))?.value;
  return !!value && value === sign(draftId);
}
