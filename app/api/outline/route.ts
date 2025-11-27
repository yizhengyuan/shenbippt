import { NextRequest, NextResponse } from "next/server";
import { generateOutline } from "@/lib/gemini";
import { OutlineRequest } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body: OutlineRequest = await request.json();
    const { topic, pageCount } = body;

    if (!topic || !pageCount) {
      return NextResponse.json(
        { error: "Missing required fields: topic and pageCount" },
        { status: 400 }
      );
    }

    if (pageCount < 3 || pageCount > 20) {
      return NextResponse.json(
        { error: "Page count must be between 3 and 20" },
        { status: 400 }
      );
    }

    const slides = await generateOutline(topic, pageCount);

    return NextResponse.json({ slides });
  } catch (error) {
    console.error("Error generating outline:", error);
    return NextResponse.json(
      { error: "Failed to generate outline" },
      { status: 500 }
    );
  }
}

