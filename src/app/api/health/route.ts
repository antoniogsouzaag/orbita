import { NextResponse } from "next/server";
import { buildCommit } from "@/lib/build-info";

/** Saúde do app para monitores externos (sem dados). `commit` é a versão publicada, para comparar com a main. */
export async function GET() {
  return NextResponse.json({ ok: true, app: "orbita", commit: buildCommit(), time: new Date().toISOString() });
}
