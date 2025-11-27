import PptxGenJS from "pptxgenjs";
import { Slide } from "@/types";

export async function createPptx(slides: Slide[], title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  
  pptx.title = title;
  pptx.author = "PPT Agent";
  pptx.subject = title;
  
  // 设置幻灯片尺寸为 16:9
  pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
  pptx.layout = "LAYOUT_16x9";

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    
    // 添加背景图片
    if (slideData.imageUrl) {
      // 处理 base64 图片
      if (slideData.imageUrl.startsWith("data:")) {
        slide.addImage({
          data: slideData.imageUrl,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
        });
      } else {
        slide.addImage({
          path: slideData.imageUrl,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
        });
      }
    }

    // 添加半透明背景层以提高文字可读性
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { color: "000000", transparency: 50 },
    });

    // 添加标题
    slide.addText(slideData.title, {
      x: 0.5,
      y: 0.5,
      w: 9,
      h: 1,
      fontSize: 32,
      fontFace: "Microsoft YaHei",
      color: "FFFFFF",
      bold: true,
      align: "left",
      valign: "middle",
    });

    // 添加内容
    slide.addText(slideData.content, {
      x: 0.5,
      y: 1.8,
      w: 9,
      h: 3,
      fontSize: 18,
      fontFace: "Microsoft YaHei",
      color: "FFFFFF",
      align: "left",
      valign: "top",
    });

    // 添加页码
    slide.addText(`${slideData.pageNumber}`, {
      x: 9,
      y: 5,
      w: 0.5,
      h: 0.4,
      fontSize: 12,
      fontFace: "Arial",
      color: "FFFFFF",
      align: "right",
    });
  }

  // 生成 Buffer
  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

