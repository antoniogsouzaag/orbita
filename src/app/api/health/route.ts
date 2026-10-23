import { NextResponse } from "next/server";

/** Saúde do app para monitores externos (sem dados). */
export async function GET() {
  return NextResponse.json({ ok: true, app: "orbita", time: new Date().toISOString() });
}
