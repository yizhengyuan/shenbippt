import { NextRequest, NextResponse } from "next/server";
import { generateImage as generateImageWithSiliconFlow } from "@/lib/gemini";
import { generateImage as generateImageWithSD } from "@/lib/gemini-sd";
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

    // 检查使用哪种图像生成方式
  const useLocalSD = process.env.NEXT_PUBLIC_IMAGE_GENERATION_SOURCE === 'local';
  let imageUrl: string;

  try {
    if (useLocalSD) {
      console.log('Using local Stable Diffusion API...');
      imageUrl = await generateImageWithSD(prompt, styleTheme);
    } else {
      console.log('Using SiliconFlow API...');
      imageUrl = await generateImageWithSiliconFlow(prompt, styleTheme);
    }
  } catch (error) {
    // 如果本地 API 失败，尝试回退到 SiliconFlow
    if (useLocalSD && process.env.SILICONFLOW_API_KEY) {
      console.log('Local SD failed, falling back to SiliconFlow...', error);
      try {
        imageUrl = await generateImageWithSiliconFlow(prompt, styleTheme);
      } catch (fallbackError) {
        throw fallbackError;
      }
    } else {
      throw error;
    }
  }

    return NextResponse.json({ imageUrl });
  } catch (error) {
    console.error("Error generating image:", error);
    return NextResponse.json(
      { error: "Failed to generate image" },
      { status: 500 }
    );
  }
}

