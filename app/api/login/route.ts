import { NextResponse } from "next/server";
import { authenticate, sessionToken, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  let body: { name?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  // Name is optional so an existing bookmark with just a password still works;
  // it falls back to carlos, which is who the single password always was.
  const name = (body.name || "carlos").trim();
  const user = authenticate(name, body.password || "");

  if (!user) {
    // Deliberately vague. Saying "no such user" tells an attacker which names exist.
    return NextResponse.json({ error: "wrong name or password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, user });
  res.cookies.set(COOKIE_NAME, sessionToken(user), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
