import { NextResponse } from "next/server";

export async function GET() {
  const hasKey = !!process.env.SILICONFLOW_API_KEY;
  return NextResponse.json(
    { status: "ok", hasApiKey: hasKey },
    { status: hasKey ? 200 : 500 }
  );
}