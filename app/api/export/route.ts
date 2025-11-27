import { NextRequest, NextResponse } from "next/server";
import { createPptx } from "@/lib/pptx";
import { ExportRequest } from "@/types";

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

    const pptxBuffer = await createPptx(slides, title || "Presentation");

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
    return NextResponse.json(
      { error: "Failed to export PPTX" },
      { status: 500 }
    );
  }
}

