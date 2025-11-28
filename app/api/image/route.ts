import { NextRequest, NextResponse } from "next/server";
import { generateImage } from "@/lib/gemini";
import { ImageRequest } from "@/types";

// 设置最大执行时间（秒）
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body: ImageRequest = await request.json();
    const { prompt, styleTheme } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Missing required field: prompt" },
        { status: 400 }
      );
    }

    const imageUrl = await generateImage(prompt, styleTheme);

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}

