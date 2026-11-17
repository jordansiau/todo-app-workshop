import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  generateRegistrationOptions,
  generateAuthenticationOptions,
  verifyRegistrationResponse,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from "@simplewebauthn/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { AppError, db, newChallenge, consumeChallenge } from "@/lib/db";
import { createSession, deleteSession, getSession } from "@/lib/auth";
import { checkOrigin, failure, readJSON } from "@/lib/http";
import { nowISO } from "@/lib/timezone";
export const runtime = "nodejs";
const attempts = new Map<string, { count: number; until: number }>();
function rateLimit(username: string) {
  const now = Date.now();
  for (const [key, v] of attempts) if (v.until < now) attempts.delete(key);
  const entry = attempts.get(username) || { count: 0, until: now + 60000 };
  if (++entry.count > 20)
    throw new AppError(
      "Too many passkey attempts. Try again in a minute.",
      429,
    );
  attempts.set(username, entry);
}
export async function GET() {
  const session = await getSession();
  return NextResponse.json(
    session
      ? { user: { id: session.userId, username: session.username } }
      : { error: "Not authenticated" },
    { status: session ? 200 : 401, headers: { "Cache-Control": "no-store" } },
  );
}
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ action: string }> },
) {
  try {
    checkOrigin(req);
    const { action } = await params;
    if (action === "logout") {
      await deleteSession();
      return NextResponse.json({ ok: true });
    }
    const body = z.record(z.string(), z.unknown()).parse(await readJSON(req));
    const expectedOrigin = process.env.RP_ORIGIN || req.nextUrl.origin;
    const rpID = process.env.RP_ID || new URL(expectedOrigin).hostname;
    if (
      process.env.NODE_ENV === "production" &&
      (!process.env.RP_ORIGIN || !process.env.RP_ID)
    )
      throw new Error("Configure production relying party");
    if (action.endsWith("-options")) {
      const username = z
        .string()
        .trim()
        .min(3)
        .max(50)
        .regex(
          /^[a-zA-Z0-9_.-]+$/,
          "Use letters, numbers, periods, underscores or hyphens",
        )
        .parse(body.username);
      rateLimit(username.toLowerCase());
      const user = db()
        .prepare("SELECT id,username FROM users WHERE username=?")
        .get(username) as { id: number; username: string } | undefined;
      if (action === "register-options") {
        if (user)
          throw new AppError(
            "Username already registered. Sign in instead.",
            409,
          );
        const options = await generateRegistrationOptions({
          rpName: process.env.RP_NAME || "Todo Workshop",
          rpID,
          userName: username,
          userID: randomBytes(32),
          attestationType: "none",
          authenticatorSelection: {
            residentKey: "preferred",
            userVerification: "required",
          },
        });
        (await cookies()).set(
          "passkey-attempt",
          newChallenge(username, "register", options.challenge),
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 300,
          },
        );
        return NextResponse.json(options);
      }
      if (action === "login-options") {
        if (!user)
          throw new AppError(
            "Unable to sign in. Check your username or register a passkey.",
            400,
          );
        const credentials = db()
          .prepare(
            "SELECT credential_id,transports FROM authenticators WHERE user_id=?",
          )
          .all(user.id) as { credential_id: string; transports: string }[];
        const options = await generateAuthenticationOptions({
          rpID,
          userVerification: "required",
          allowCredentials: credentials.map((c) => ({
            id: c.credential_id,
            transports: JSON.parse(c.transports),
          })),
        });
        (await cookies()).set(
          "passkey-attempt",
          newChallenge(user.username, "login", options.challenge),
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            path: "/",
            maxAge: 300,
          },
        );
        return NextResponse.json(options);
      }
    }
    const attempt = (await cookies()).get("passkey-attempt")?.value || "";
    if (action === "register-verify") {
      const c = consumeChallenge(attempt, "register");
      (await cookies()).delete("passkey-attempt");
      let result;
      try {
        result = await verifyRegistrationResponse({
          response: body as unknown as RegistrationResponseJSON,
          expectedChallenge: c.challenge,
          expectedOrigin,
          expectedRPID: rpID,
          requireUserVerification: true,
        });
      } catch {
        throw new AppError("Passkey verification failed");
      }
      if (!result.verified) throw new AppError("Passkey verification failed");
      const credential = result.registrationInfo.credential;
      const userId = db().transaction(() => {
        if (
          db().prepare("SELECT id FROM users WHERE username=?").get(c.username)
        )
          throw new AppError("Username already registered", 409);
        const id = Number(
          db()
            .prepare("INSERT INTO users(username,created_at) VALUES(?,?)")
            .run(c.username, nowISO()).lastInsertRowid,
        );
        db()
          .prepare(
            "INSERT INTO authenticators(user_id,credential_id,credential_public_key,counter,transports,created_at) VALUES(?,?,?,?,?,?)",
          )
          .run(
            id,
            credential.id,
            Buffer.from(credential.publicKey),
            credential.counter ?? 0,
            JSON.stringify(credential.transports || []),
            nowISO(),
          );
        return id;
      })();
      await createSession({ userId, username: c.username });
      return NextResponse.json({ ok: true });
    }
    if (action === "login-verify") {
      const c = consumeChallenge(attempt, "login");
      (await cookies()).delete("passkey-attempt");
      const row = db()
        .prepare(
          "SELECT a.*,u.username FROM authenticators a JOIN users u ON u.id=a.user_id WHERE u.username=? AND a.credential_id=?",
        )
        .get(c.username, body.id || "") as
        | {
            user_id: number;
            username: string;
            credential_id: string;
            credential_public_key: Buffer;
            counter: number;
            transports: string;
          }
        | undefined;
      if (!row) throw new AppError("Passkey verification failed");
      let result;
      try {
        result = await verifyAuthenticationResponse({
          response: body as unknown as AuthenticationResponseJSON,
          expectedChallenge: c.challenge,
          expectedOrigin,
          expectedRPID: rpID,
          requireUserVerification: true,
          credential: {
            id: row.credential_id,
            publicKey: new Uint8Array(row.credential_public_key),
            counter: row.counter ?? 0,
            transports: JSON.parse(
              row.transports,
            ) as AuthenticatorTransportFuture[],
          },
        });
      } catch {
        throw new AppError("Passkey verification failed");
      }
      if (!result.verified) throw new AppError("Passkey verification failed");
      // Compare-and-swap counters also rejects simultaneous assertions using stale state.
      if (
        !db()
          .prepare(
            "UPDATE authenticators SET counter=? WHERE credential_id=? AND counter=?",
          )
          .run(
            result.authenticationInfo.newCounter,
            row.credential_id,
            row.counter ?? 0,
          ).changes
      )
        throw new AppError("Passkey state changed. Sign in again.");
      await createSession({ userId: row.user_id, username: row.username });
      return NextResponse.json({ ok: true });
    }
    throw new AppError("Not found", 404);
  } catch (e) {
    return failure(e);
  }
}
