import PptxGenJS from "pptxgenjs";
import { Slide } from "@/types";

// 文字阴影效果配置
const textShadow = {
  type: "outer" as const,
  color: "000000",
  blur: 3,
  offset: 1,
  angle: 45,
};

export async function createPptx(slides: Slide[], title: string): Promise<Buffer> {
  const pptx = new PptxGenJS();
  
  pptx.title = title;
  pptx.author = "神笔PPT";
  pptx.subject = title;
  
  // 设置幻灯片尺寸为 16:9
  pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
  pptx.layout = "LAYOUT_16x9";

  for (const slideData of slides) {
    const slide = pptx.addSlide();
    const isFirstSlide = slideData.pageNumber === 1;
    const isLastSlide = slideData.pageNumber === slides.length;
    
    // 添加背景图片
    if (slideData.imageUrl) {
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

    // 添加半透明背景层 - 增强不透明度以提高文字可读性
    // transparency: 35 表示 65% 不透明，比之前的 50 更暗
    slide.addShape("rect", {
      x: 0,
      y: 0,
      w: "100%",
      h: "100%",
      fill: { color: "000000", transparency: 35 },
    });

    // 封面页和结尾页使用居中大标题布局
    if (isFirstSlide || isLastSlide) {
      // 主标题 - 居中显示
      slide.addText(slideData.title, {
        x: 0.5,
        y: 1.8,
        w: 9,
        h: 1.2,
        fontSize: 44,
        fontFace: "Microsoft YaHei",
        color: "FFFFFF",
        bold: true,
        align: "center",
        valign: "middle",
        shadow: textShadow,
      });

      // 副标题
      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.5,
          y: 3.0,
          w: 9,
          h: 0.8,
          fontSize: 24,
          fontFace: "Microsoft YaHei",
          color: "E0E0E0",
          align: "center",
          valign: "middle",
          shadow: textShadow,
        });
      }

      // 内容描述（较小字体）
      if (slideData.content && !isLastSlide) {
        slide.addText(slideData.content, {
          x: 1,
          y: 4.0,
          w: 8,
          h: 1,
          fontSize: 16,
          fontFace: "Microsoft YaHei",
          color: "CCCCCC",
          align: "center",
          valign: "top",
          shadow: textShadow,
        });
      }
    } else {
      // 内容页布局
      // 主标题
      slide.addText(slideData.title, {
        x: 0.5,
        y: 0.3,
        w: 9,
        h: 0.8,
        fontSize: 32,
        fontFace: "Microsoft YaHei",
        color: "FFFFFF",
        bold: true,
        align: "left",
        valign: "middle",
        shadow: textShadow,
      });

      // 副标题
      if (slideData.subtitle) {
        slide.addText(slideData.subtitle, {
          x: 0.5,
          y: 1.0,
          w: 9,
          h: 0.5,
          fontSize: 18,
          fontFace: "Microsoft YaHei",
          color: "E0E0E0",
          align: "left",
          valign: "middle",
          shadow: textShadow,
        });
      }

      // 内容描述
      const contentY = slideData.subtitle ? 1.6 : 1.2;
      slide.addText(slideData.content, {
        x: 0.5,
        y: contentY,
        w: 9,
        h: 1.0,
        fontSize: 14,
        fontFace: "Microsoft YaHei",
        color: "DDDDDD",
        align: "left",
        valign: "top",
        shadow: textShadow,
      });

      // 要点列表 - 使用 bullet points
      if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
        const bulletY = contentY + 1.1;
        const bulletTexts = slideData.bulletPoints.map(point => ({
          text: point,
          options: { 
            bullet: { type: "bullet" as const, code: "25CF" }, // 实心圆点
            fontSize: 16,
            color: "FFFFFF",
            fontFace: "Microsoft YaHei",
            shadow: textShadow,
          }
        }));

        slide.addText(bulletTexts, {
          x: 0.5,
          y: bulletY,
          w: 9,
          h: 3.0,
          valign: "top",
          paraSpaceAfter: 8,
        });
      }
    }

    // 添加页码
    slide.addText(`${slideData.pageNumber}`, {
      x: 9,
      y: 5.1,
      w: 0.5,
      h: 0.4,
      fontSize: 12,
      fontFace: "Arial",
      color: "AAAAAA",
      align: "right",
      shadow: textShadow,
    });
  }

  // 生成 Buffer
  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}

