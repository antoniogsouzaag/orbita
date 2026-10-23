import { NextResponse } from "next/server";
export async function GET() {
  return NextResponse.json({ configured: false, total: 0, up: 0, down: [], checkedAt: new Date().toISOString() });
}
