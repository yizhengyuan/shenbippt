import { NextRequest, NextResponse } from "next/server";
import { generateOutline } from "@/lib/gemini";
import { OutlineRequest, TemplateStyle } from "@/types";

// 设置最大执行时间（秒）
export const maxDuration = 60;

interface ExtendedOutlineRequest extends OutlineRequest {
  templateStyle?: TemplateStyle;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExtendedOutlineRequest = await request.json();
    const { topic, pageCount, templateStyle } = body;

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

    const result = await generateOutline(topic, pageCount, templateStyle);

    return NextResponse.json({
      slides: result.slides,
      styleTheme: result.styleTheme
    });
  } catch (error) {
    console.error("Error generating outline:", error);
    return NextResponse.json(
      { error: "Failed to generate outline" },
      { status: 500 }
    );
  }
}
