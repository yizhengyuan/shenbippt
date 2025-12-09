import PptxGenJS from "pptxgenjs";
import sharp from "sharp";
import { Slide } from "@/types";

// 透明文本框样式（无背景、无边框）
const transparentTextBox = {
  fill: { color: "FFFFFF", transparency: 100 },  // 100% 透明
  line: { width: 0 },  // 无边框
};

// 深色主题文字颜色（用于亮色背景）
const darkThemeColors = {
  title: "1A1A1A",       // 近黑色
  subtitle: "333333",    // 深灰
  content: "444444",     // 中灰
  bullet: "1A1A1A",      // 近黑色
  pageNum: "666666",     // 灰色
};

// 浅色主题文字颜色（用于暗色背景）
const lightThemeColors = {
  title: "FFFFFF",       // 纯白
  subtitle: "E0E0E0",    // 浅灰白
  content: "DDDDDD",     // 更浅灰
  bullet: "FFFFFF",      // 纯白
  pageNum: "AAAAAA",     // 灰色
};

/**
 * 分析图片亮度，判断是否为亮色图片
 * @param base64Image base64 编码的图片（包含 data:image/xxx;base64, 前缀）
 * @returns true 如果图片整体偏亮，false 如果整体偏暗
 */
async function isImageBright(base64Image: string): Promise<boolean> {
  try {
    // 提取 base64 数据部分
    const base64Data = base64Image.includes(",")
      ? base64Image.split(",")[1]
      : base64Image;

    const imageBuffer = Buffer.from(base64Data, "base64");

    // 使用 sharp 获取图片统计信息
    const stats = await sharp(imageBuffer)
      .resize(100, 100, { fit: "cover" }) // 缩小以加快处理
      .greyscale() // 转为灰度
      .stats();

    // 计算平均亮度（0-255）
    const avgBrightness = stats.channels[0].mean;

    // 阈值：128 为中间值，可调整
    // 考虑到大多数图片上半部分（标题区域）可能更亮，稍微降低阈值
    return avgBrightness > 120;
  } catch (error) {
    console.error("Failed to analyze image brightness:", error);
    // 默认假设暗色背景，使用浅色文字
    return false;
  }
}

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

    // 分析背景图片亮度，决定使用深色还是浅色文字
    let colors = lightThemeColors; // 默认浅色文字
    if (slideData.imageUrl && slideData.imageUrl.startsWith("data:")) {
      const isBright = await isImageBright(slideData.imageUrl);
      colors = isBright ? darkThemeColors : lightThemeColors;
    }

    // 添加背景图片（只使用 base64，确保可靠性）
    if (slideData.imageUrl && slideData.imageUrl.startsWith("data:")) {
      try {
        slide.addImage({
          data: slideData.imageUrl,
          x: 0,
          y: 0,
          w: "100%",
          h: "100%",
        });
      } catch (imgError) {
        console.error(`Failed to add image for slide ${slideData.pageNumber}:`, imgError);
        // 图片添加失败，继续处理其他内容
      }
    }

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
        color: colors.title,
        bold: true,
        align: "center",
        valign: "middle",
        ...transparentTextBox,
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
          color: colors.subtitle,
          align: "center",
          valign: "middle",
          ...transparentTextBox,
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
          color: colors.content,
          align: "center",
          valign: "top",
          ...transparentTextBox,
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
        color: colors.title,
        bold: true,
        align: "left",
        valign: "middle",
        ...transparentTextBox,
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
          color: colors.subtitle,
          align: "left",
          valign: "middle",
          ...transparentTextBox,
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
        color: colors.content,
        align: "left",
        valign: "top",
        ...transparentTextBox,
      });

      // 要点列表 - 使用 bullet points
      if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
        const bulletY = contentY + 1.1;
        const bulletTexts = slideData.bulletPoints.map(point => ({
          text: point,
          options: {
            bullet: { type: "bullet" as const, code: "25CF" }, // 实心圆点
            fontSize: 16,
            color: colors.bullet,
            fontFace: "Microsoft YaHei",
          }
        }));

        slide.addText(bulletTexts, {
          x: 0.5,
          y: bulletY,
          w: 9,
          h: 3.0,
          valign: "top",
          paraSpaceAfter: 8,
          ...transparentTextBox,
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
      color: colors.pageNum,
      align: "right",
      ...transparentTextBox,
    });
  }

  // 生成 Buffer
  const buffer = await pptx.write({ outputType: "nodebuffer" });
  return buffer as Buffer;
}



