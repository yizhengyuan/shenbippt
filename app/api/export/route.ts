import { NextRequest, NextResponse } from "next/server";
import { createPptx } from "@/lib/pptx";
import { ExportRequest } from "@/types";

// 设置最大执行时间（秒）
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body: ExportRequest = await request.json();
    const { slides, title } = body;

    if (!slides || slides.length === 0) {
      return NextResponse.json(
        { error: "Missing required field: slides" },
        { status: 400 }
      );
    }

    // 过滤掉没有有效图片的幻灯片数据，避免错误
    const validSlides = slides.map(slide => ({
      ...slide,
      // 只保留有效的 base64 图片，其他情况清空
      imageUrl: slide.imageUrl?.startsWith("data:") ? slide.imageUrl : "",
    }));

    console.log(`Creating PPTX with ${validSlides.length} slides...`);
    const pptxBuffer = await createPptx(validSlides, title || "Presentation");
    console.log(`PPTX created successfully, size: ${pptxBuffer.length} bytes`);

    // 返回 PPTX 文件
    return new NextResponse(new Uint8Array(pptxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title || "presentation")}.pptx"`,
      },
    });
  } catch (error) {
    console.error("Error exporting PPTX:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to export PPTX: ${errorMessage}` },
      { status: 500 }
    );
  }
}

