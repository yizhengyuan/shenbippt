"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import PptxGenJS from "pptxgenjs";
import { Button } from "@/components/ui/button";
import { SlideCard } from "@/components/SlideCard";
import { SlideThumbnail } from "@/components/SlideThumbnail";
import { Slide, SlideOutline, StyleTheme, TemplateStyle } from "@/types";

// 禁用静态生成，强制使用客户端渲染
export const dynamic = 'force-dynamic';

type GenerationStatus = "idle" | "outline" | "images" | "done" | "error";

export default function GeneratePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [pageCount, setPageCount] = useState(5);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [selectedSlideIndex, setSelectedSlideIndex] = useState(0);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [regeneratingSlides, setRegeneratingSlides] = useState<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  // 保存统一的风格主题
  const styleThemeRef = useRef<StyleTheme | null>(null);
  // 用户上传的模版风格
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle | null>(null);

  // 从 sessionStorage 获取参数
  useEffect(() => {
    const storedTopic = sessionStorage.getItem("ppt-topic");
    const storedPageCount = sessionStorage.getItem("ppt-pageCount");
    const storedTemplateStyle = sessionStorage.getItem("ppt-templateStyle");

    if (!storedTopic) {
      router.push("/");
      return;
    }

    setTopic(storedTopic);
    setPageCount(parseInt(storedPageCount || "5", 10));

    // 读取用户上传的模版风格
    if (storedTemplateStyle) {
      try {
        setTemplateStyle(JSON.parse(storedTemplateStyle));
      } catch (e) {
        console.error("Failed to parse template style:", e);
      }
    }
  }, [router]);

  // 计时器
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (startTime && status !== "done" && status !== "error" && status !== "idle") {
      timer = setInterval(() => {
        setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [startTime, status]);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  // 延迟函数
  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  // 将远程图片 URL 转换为 base64（预下载，加速导出）
  const urlToBase64 = async (url: string): Promise<string> => {
    try {
      // 如果已经是 base64，直接返回
      if (url.startsWith("data:")) return url;
      if (!url || url.trim() === "") return "";

      // 添加超时控制（10秒）
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("Failed to fetch image:", response.status);
        return ""; // 返回空字符串表示无图片
      }

      const blob = await response.blob();

      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = () => {
          console.error("FileReader error");
          resolve(""); // 失败时返回空字符串
        };
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to convert image to base64:", error);
      return ""; // 失败时返回空字符串，避免传远程 URL
    }
  };

  // 生成大纲（同时返回统一风格主题）
  const generateOutlineWithTheme = useCallback(async (): Promise<{ slides: SlideOutline[]; styleTheme: StyleTheme; backgroundImage?: string }> => {
    const response = await fetch("/api/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        topic,
        pageCount,
        // 传递用户上传的模版风格
        templateStyle: templateStyle || undefined,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate outline");
    }

    const data = await response.json();
    return { slides: data.slides, styleTheme: data.styleTheme, backgroundImage: data.backgroundImage };
  }, [topic, pageCount, templateStyle]);

  // 生成单张图片（带重试，传递统一风格，自动转 base64）
  const generateImage = async (prompt: string, styleTheme?: StyleTheme, retries = 3): Promise<string> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        // 如果有用户上传的模版风格，使用其 imageStylePrompt 增强描述
        const enhancedPrompt = templateStyle?.imageStylePrompt
          ? `${templateStyle.imageStylePrompt}. ${prompt}`
          : prompt;

        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: enhancedPrompt, styleTheme }),
        });

        if (response.status === 429) {
          console.log(`Rate limited, waiting before retry ${attempt + 1}...`);
          await delay(5000 * (attempt + 1)); // 指数退避
          continue;
        }

        if (!response.ok) {
          throw new Error("Failed to generate image");
        }

        const data = await response.json();
        const imageUrl = data.imageUrl;

        // 立即将远程 URL 转换为 base64，加速后续导出
        const base64Image = await urlToBase64(imageUrl);
        return base64Image;
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await delay(2000 * (attempt + 1));
      }
    }
    throw new Error("Max retries exceeded");
  };

  // 开始生成流程
  const startGeneration = useCallback(async () => {
    if (!topic) return;

    setStatus("outline");
    setProgress(0);
    setErrorMessage("");
    setStartTime(Date.now());
    setElapsedTime(0);

    try {
      // 1. 生成大纲（包含统一风格主题和背景）
      const { slides: outlines, styleTheme, backgroundImage } = await generateOutlineWithTheme();
      styleThemeRef.current = styleTheme; // 保存风格主题
      setProgress(10);

      // 2. 使用统一的背景图片
      const backgroundPrompt = backgroundImage || outlines[0]?.imagePrompt || "Clean professional presentation background";
      let backgroundImageUrl = "";

      // 只生成一次背景图片
      try {
        backgroundImageUrl = await generateImage(backgroundPrompt, styleTheme);
      } catch (err) {
        console.error("Failed to generate background image:", err);
      }

      // 3. 初始化幻灯片，所有页面使用相同的背景
      const initialSlides: Slide[] = outlines.map((outline, index) => ({
        id: uuidv4(),
        pageNumber: index + 1,
        title: outline.title,
        subtitle: outline.subtitle,
        content: outline.content,
        bulletPoints: outline.bulletPoints,
        imageUrl: backgroundImageUrl, // 使用统一的背景图片
        imagePrompt: backgroundPrompt, // 保存背景提示词
      }));
      setSlides(initialSlides);
      setStatus("images");

      // 更新进度到100%（不需要单独生成每页图片）
      setProgress(100);
      setStatus("done");
    } catch (err) {
      console.error("Generation error:", err);
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "生成失败，请重试");
    }
  }, [topic, generateOutlineWithTheme]);

  useEffect(() => {
    if (topic && status === "idle") {
      startGeneration();
    }
  }, [topic, status, startGeneration]);

  // 重新生成单页（使用保存的统一风格）
  const regenerateSlide = async (slideId: string) => {
    const slide = slides.find((s) => s.id === slideId);
    if (!slide) return;

    setRegeneratingSlides((prev) => new Set(prev).add(slideId));

    try {
      // 使用保存的统一风格主题
      const imageUrl = await generateImage(slide.imagePrompt, styleThemeRef.current || undefined);
      setSlides((prev) =>
        prev.map((s) => (s.id === slideId ? { ...s, imageUrl } : s))
      );
    } catch (err) {
      console.error("Failed to regenerate slide:", err);
    } finally {
      setRegeneratingSlides((prev) => {
        const next = new Set(prev);
        next.delete(slideId);
        return next;
      });
    }
  };

  // 客户端生成 PPTX（避免服务器请求大小限制）
  const exportPptx = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      const pptx = new PptxGenJS();
      pptx.title = topic;
      pptx.author = "神笔PPT";
      pptx.subject = topic;

      // 设置幻灯片尺寸为 16:9
      pptx.defineLayout({ name: "LAYOUT_16x9", width: 10, height: 5.625 });
      pptx.layout = "LAYOUT_16x9";

      for (const slideData of slides) {
        const slide = pptx.addSlide();
        const isFirstSlide = slideData.pageNumber === 1;
        const isLastSlide = slideData.pageNumber === slides.length;

        // 添加背景图片
        if (slideData.imageUrl && slideData.imageUrl.startsWith("data:")) {
          try {
            slide.addImage({ data: slideData.imageUrl, x: 0, y: 0, w: "100%", h: "100%" });
          } catch (e) {
            console.error("Failed to add image:", e);
          }
        }

        // 移除全局遮罩层，还原图片本色
        // slide.addShape("rect", { ... });

        // 颜色定义
        const blackColor = "000000"; // 纯黑色
        const primaryColor = templateStyle?.primaryColor ? templateStyle.primaryColor.replace("#", "") : "2563EB"; // 主色
        const secondaryColor = templateStyle?.secondaryColor ? templateStyle.secondaryColor.replace("#", "") : "64748B"; // 辅助色

        // 确保颜色值是有效的6位十六进制
        const formatColor = (color: string) => {
          const cleanColor = color.replace("#", "");
          return cleanColor.length === 3 ? cleanColor.split("").map(c => c + c).join("") : cleanColor;
        };

        const primary = formatColor(primaryColor);
        const secondary = formatColor(secondaryColor);

        if (isFirstSlide || isLastSlide) {
          // 封面/结尾页 - 更现代的布局
          // 主标题
          slide.addText(slideData.title || "", {
            x: 1, y: 2, w: 8, h: 1.2,
            fontSize: 44,
            fontFace: "Arial Black",
            color: blackColor,
            bold: true,
            align: "center",
            valign: "middle",
          });

          // 副标题（如果存在）
          if (slideData.subtitle) {
            slide.addText(slideData.subtitle, {
              x: 1.5, y: 3.4, w: 7, h: 0.6,
              fontSize: 24,
              fontFace: "Arial",
              color: secondaryColor,
              bold: false,
              align: "center",
              valign: "middle",
              italic: true,
            });
          }

          // 装饰线
          slide.addShape(pptx.ShapeType.line, {
            x: 3.5, y: 4.2, w: 3, h: 0,
            line: { color: primary, width: 3 },
          });

          // 内容（仅在结尾页显示）
          if (isLastSlide && slideData.content) {
            slide.addText(slideData.content, {
              x: 1.5, y: 4.6, w: 7, h: 0.8,
              fontSize: 18,
              fontFace: "Arial",
              color: secondary,
              align: "center",
              valign: "middle",
              lineSpacing: 1.4,
            });
          }
        } else {
          // 内容页 - 优化的专业布局

          // 顶部装饰条
          slide.addShape(pptx.ShapeType.rect, {
            x: 0, y: 0, w: 10, h: 0.1,
            fill: { color: primary },
          });

          // 标题区域 - 使用渐变背景
          slide.addShape(pptx.ShapeType.roundRect, {
            x: 0.5, y: 0.3, w: 9, h: 0.9,
            fill: { color: primary + "10" }, // 10% 透明度
            line: { color: primary, width: 1 },
          });

          slide.addText(slideData.title || "", {
            x: 0.7, y: 0.45, w: 8.6, h: 0.6,
            fontSize: 32,
            fontFace: "Arial",
            color: primary,
            bold: true,
            align: "left",
            valign: "middle",
          });

          // 副标题
          let currentY = 1.4;
          if (slideData.subtitle) {
            slide.addText(slideData.subtitle, {
              x: 0.7, y: currentY, w: 8.6, h: 0.5,
              fontSize: 18,
              fontFace: "Arial",
              color: secondary,
              bold: true,
              align: "left",
              valign: "middle",
              italic: true,
            });
            currentY += 0.7;
          }

          // 分隔线
          slide.addShape(pptx.ShapeType.line, {
            x: 0.7, y: currentY, w: 8.6, h: 0,
            line: { color: primary + "40", width: 1, dashType: "dash" },
          });
          currentY += 0.3;

          // 内容区域 - 优化显示
          if (slideData.content) {
            // 内容框
            slide.addShape(pptx.ShapeType.roundRect, {
              x: 0.7, y: currentY, w: 8.6, h: 1.2,
              fill: { color: "F8FAFC" }, // 浅灰背景
              line: { color: "E2E8F0", width: 1 },
            });

            // 处理内容文本
            const contentText = slideData.content.length > 200
              ? slideData.content.substring(0, 200) + "..."
              : slideData.content;

            slide.addText(contentText, {
              x: 0.9, y: currentY + 0.1, w: 8.2, h: 1,
              fontSize: 15,
              fontFace: "Arial",
              color: blackColor,
              align: "left",
              valign: "top",
              lineSpacing: 1.5,
              paraSpaceBefore: 5,
              paraSpaceAfter: 5,
            });
            currentY += 1.5;
          }

          // 要点列表 - 改进的样式
          if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
            // 为每个要点创建卡片式布局
            const bulletHeight = 0.5;
            const bulletSpacing = 0.15;
            const maxBullets = Math.min(slideData.bulletPoints.length, 6);

            slideData.bulletPoints.slice(0, maxBullets).forEach((point, index) => {
              const yPos = currentY + index * (bulletHeight + bulletSpacing);

              // 背景卡片（交替颜色）
              const bgColor = index % 2 === 0 ? "F1F5F9" : "FFFFFF";
              slide.addShape(pptx.ShapeType.roundRect, {
                x: 0.7, y: yPos, w: 8.6, h: bulletHeight,
                fill: { color: bgColor },
                line: { color: "E2E8F0", width: 0.5 },
              });

              // 自定义项目符号
              slide.addShape(pptx.ShapeType.ellipse, {
                x: 0.9, y: yPos + 0.15, w: 0.2, h: 0.2,
                fill: { color: primary },
              });

              // 要点文本
              slide.addText(point, {
                x: 1.3, y: yPos + 0.05, w: 7.8, h: bulletHeight - 0.1,
                fontSize: 14,
                fontFace: "Arial",
                color: blackColor,
                align: "left",
                valign: "middle",
                lineSpacing: 1.3,
              });
            });
          }

          // 底部装饰
          slide.addShape(pptx.ShapeType.line, {
            x: 1, y: 5.3, w: 8, h: 0,
            line: { color: primary + "20", width: 1 },
          });
        }

        // 页码
        slide.addText(`${slideData.pageNumber}`, {
          x: 9, y: 5.1, w: 0.5, h: 0.4,
          fontSize: 10, fontFace: "Arial", color: "999999",
          align: "right",
        });
      }

      // 直接在浏览器生成并下载
      await pptx.writeFile({ fileName: `${topic}.pptx` });
      setIsExporting(false);
    } catch (err) {
      console.error("Export error:", err);
      alert("导出失败，请重试");
      setIsExporting(false);
    }
  };

  const goBack = () => {
    sessionStorage.removeItem("ppt-topic");
    sessionStorage.removeItem("ppt-pageCount");
    router.push("/");
  };

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 pb-20">
      {/* 顶部导航栏 */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-200 h-16 flex items-center justify-between px-4 md:px-8 shadow-sm">
        <button
          onClick={goBack}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-medium">返回首页</span>
        </button>

        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          {status === "done" ? (
            <span className="px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium border border-emerald-200 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              生成完成
            </span>
          ) : status === "error" ? (
            <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-200 shadow-sm">
              生成中断
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-teal-50 text-teal-700 text-xs font-medium border border-teal-200 flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
              AI 思考中
            </span>
          )}
        </div>

        {/* 计时器 */}
        <div className="font-mono text-sm bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-emerald-700 font-medium shadow-sm">
          ⏱ {formatTime(elapsedTime)}
        </div>
      </header>

      <div className="pt-24 container mx-auto px-4">
        {/* 标题区域 */}
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
            {topic}
          </h1>
          <p className="text-slate-500 text-sm">共 {pageCount} 页幻灯片</p>
        </div>

        {/* 进度条 */}
        {(status === "outline" || status === "images") && (
          <div className="max-w-xl mx-auto mb-12">
            <div className="flex justify-between text-xs text-slate-500 mb-2 uppercase tracking-wider font-medium">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-slate-200/60 rounded-full overflow-hidden shadow-inner">
              <div
                className="h-full bg-gradient-to-r from-teal-400 via-emerald-500 to-teal-400 rounded-full transition-all duration-500 animate-shimmer"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-center text-xs text-slate-500 mt-3 animate-pulse">
              {status === "outline" ? "正在构建演示大纲..." : "正在绘制精美配图..."}
            </p>
          </div>
        )}

        {/* 错误信息 */}
        {status === "error" && (
          <div className="max-w-md mx-auto mb-10 p-6 bg-red-50 border border-red-100 rounded-2xl text-center">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">生成遇到问题</h3>
            <p className="text-red-600 mb-6 text-sm">{errorMessage}</p>
            <Button onClick={startGeneration} className="bg-red-500 hover:bg-red-600 border-0 text-white">
              重试生成
            </Button>
          </div>
        )}

        {/* 新布局：左侧缩略图列表 + 右侧预览 */}
        {slides.length > 0 && (
          <div className="flex gap-6 mb-20 animate-fade-in">
            {/* 左侧缩略图列表 */}
            <div className="w-80 flex-shrink-0">
              <div className="sticky top-24 space-y-3">
                <h2 className="text-sm font-medium text-slate-600 mb-3">幻灯片列表</h2>
                <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-2">
                  {slides.map((slide, index) => (
                    <div
                      key={slide.id}
                      className="animate-fade-in-up"
                      style={{ animationDelay: `${index * 0.05}s` }}
                    >
                      <SlideThumbnail
                        slide={slide}
                        isSelected={index === selectedSlideIndex}
                        isLoading={regeneratingSlides.has(slide.id)}
                        onClick={() => setSelectedSlideIndex(index)}
                        onRegenerate={() => regenerateSlide(slide.id)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 右侧大预览 */}
            <div className="flex-1 min-w-0">
              <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                {slides[selectedSlideIndex] && (
                  <div className="aspect-video relative">
                    {/* 幻灯片图片 */}
                    {slides[selectedSlideIndex].imageUrl ? (
                      <img
                        src={slides[selectedSlideIndex].imageUrl}
                        alt={`Slide ${slides[selectedSlideIndex].pageNumber}`}
                        className="w-full h-full object-contain bg-slate-50"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
                        <div className="text-center">
                          <svg className="animate-spin h-12 w-12 text-emerald-500 mx-auto mb-4" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <p className="text-slate-500">正在生成图片...</p>
                        </div>
                      </div>
                    )}

                    {/* 页码 */}
                    <div className="absolute bottom-4 right-4 bg-black/60 text-white text-sm px-3 py-1.5 rounded-md">
                      {slides[selectedSlideIndex].pageNumber} / {slides.length}
                    </div>
                  </div>
                )}

                {/* 幻灯片详情 */}
                <div className="p-6 border-t border-slate-200">
                  <div className="space-y-4">
                    {/* 标题 */}
                    <div>
                      <h3 className="text-2xl font-bold text-slate-900">
                        {slides[selectedSlideIndex]?.title}
                      </h3>
                      {slides[selectedSlideIndex]?.subtitle && (
                        <p className="text-lg text-slate-600 mt-2">
                          {slides[selectedSlideIndex].subtitle}
                        </p>
                      )}
                    </div>

                    {/* 内容 */}
                    <div>
                      <h4 className="text-sm font-medium text-slate-500 mb-2">内容</h4>
                      <p className="text-slate-700 leading-relaxed">
                        {slides[selectedSlideIndex]?.content}
                      </p>
                    </div>

                    {/* 要点列表 */}
                    {slides[selectedSlideIndex]?.bulletPoints && slides[selectedSlideIndex].bulletPoints.length > 0 && (
                      <div>
                        <h4 className="text-sm font-medium text-slate-500 mb-2">要点</h4>
                        <ul className="space-y-2">
                          {slides[selectedSlideIndex].bulletPoints.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-slate-700">
                              <span className="text-emerald-500 mt-0.5">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* 操作按钮 */}
                    <div className="flex gap-3 pt-4">
                      <Button
                        onClick={() => regenerateSlide(slides[selectedSlideIndex]?.id || "")}
                        disabled={regeneratingSlides.has(slides[selectedSlideIndex]?.id || "") || !slides[selectedSlideIndex]?.imageUrl}
                        variant="outline"
                        size="sm"
                      >
                        {regeneratingSlides.has(slides[selectedSlideIndex]?.id || "") ? (
                          <>
                            <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            重新生成中...
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            重新生成图片
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部浮动操作栏 */}
        {status === "done" && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up">
            <div className="bg-white/90 backdrop-blur-xl border border-emerald-100 p-2 rounded-2xl shadow-xl shadow-emerald-100/50 flex items-center gap-2">
              <Button
                onClick={exportPptx}
                disabled={isExporting}
                className="h-12 px-8 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-bold rounded-xl shadow-lg shadow-emerald-500/20 transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-wait"
              >
                {isExporting ? (
                  <>
                    <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    打包下载中...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    导出 PowerPoint
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
