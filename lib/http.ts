import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "./db";
export function checkOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const expected = process.env.RP_ORIGIN || req.nextUrl.origin;
  if (
    req.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== expected)
  )
    throw new AppError("Cross-site request rejected", 403);
}
export async function readJSON(req: NextRequest) {
  const limit = 1_048_576;
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new AppError("File or request exceeds 1 MB", 413);
  const reader = req.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader)
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new AppError("File or request exceeds 1 MB", 413);
      }
      chunks.push(value);
    }
  const text = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("Invalid JSON");
  }
}
export function failure(e: unknown) {
  if (e instanceof ZodError)
    return NextResponse.json(
      {
        error: e.issues
          .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
          .join("; "),
      },
      { status: 400 },
    );
  if (e instanceof AppError)
    return NextResponse.json({ error: e.message }, { status: e.status });
  return NextResponse.json(
    { error: "Unable to complete the request. Please try again." },
    { status: 500 },
  );
}
