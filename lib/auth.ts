import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
export interface Session {
  userId: number;
  username: string;
}
const devSecret = randomBytes(32).toString("hex");
function key() {
  const value =
    process.env.JWT_SECRET ||
    (process.env.NODE_ENV === "production" ? "" : devSecret);
  if (value.length < 32 || value.startsWith("replace-with"))
    throw new Error("Set a random JWT_SECRET of at least 32 characters");
  return new TextEncoder().encode(value);
}
export async function verifySessionToken(
  token?: string,
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), {
      algorithms: ["HS256"],
      issuer: "todo-workshop",
      audience: "todo-workshop",
    });
    return typeof payload.userId === "number" &&
      typeof payload.username === "string"
      ? { userId: payload.userId, username: payload.username }
      : null;
  } catch {
    return null;
  }
}
export async function getSession() {
  return verifySessionToken((await cookies()).get("session")?.value);
}
export async function createSession(user: Session) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("todo-workshop")
    .setAudience("todo-workshop")
    .setExpirationTime("7d")
    .sign(key());
  (await cookies()).set("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 604800,
  });
}
export async function deleteSession() {
  (await cookies()).delete("session");
}
