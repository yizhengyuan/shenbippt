"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import PptxGenJS from "pptxgenjs";
import { Button } from "@/components/ui/button";
import { SlideCard } from "@/components/SlideCard";
import { Slide, SlideOutline, StyleTheme } from "@/types";

// 禁用静态生成，强制使用客户端渲染
export const dynamic = 'force-dynamic';

type GenerationStatus = "idle" | "outline" | "images" | "done" | "error";

export default function GeneratePage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [pageCount, setPageCount] = useState(5);
  const [slides, setSlides] = useState<Slide[]>([]);
  const [status, setStatus] = useState<GenerationStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [errorMessage, setErrorMessage] = useState("");
  const [regeneratingSlides, setRegeneratingSlides] = useState<Set<string>>(new Set());
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  // 保存统一的风格主题
  const styleThemeRef = useRef<StyleTheme | null>(null);

  // 从 sessionStorage 获取参数
  useEffect(() => {
    const storedTopic = sessionStorage.getItem("ppt-topic");
    const storedPageCount = sessionStorage.getItem("ppt-pageCount");

    if (!storedTopic) {
      router.push("/");
      return;
    }

    setTopic(storedTopic);
    setPageCount(parseInt(storedPageCount || "5", 10));
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
  const generateOutlineWithTheme = useCallback(async (): Promise<{ slides: SlideOutline[]; styleTheme: StyleTheme }> => {
    const response = await fetch("/api/outline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, pageCount }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate outline");
    }

    const data = await response.json();
    return { slides: data.slides, styleTheme: data.styleTheme };
  }, [topic, pageCount]);

  // 生成单张图片（带重试，传递统一风格，自动转 base64）
  const generateImage = async (prompt: string, styleTheme?: StyleTheme, retries = 3): Promise<string> => {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const response = await fetch("/api/image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt, styleTheme }),
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
      // 1. 生成大纲（包含统一风格主题）
      const { slides: outlines, styleTheme } = await generateOutlineWithTheme();
      styleThemeRef.current = styleTheme; // 保存风格主题
      setProgress(10);

      // 2. 初始化幻灯片（包含新字段）
      const initialSlides: Slide[] = outlines.map((outline, index) => ({
        id: uuidv4(),
        pageNumber: index + 1,
        title: outline.title,
        subtitle: outline.subtitle,
        content: outline.content,
        bulletPoints: outline.bulletPoints,
        imageUrl: "",
        imagePrompt: outline.imagePrompt,
      }));
      setSlides(initialSlides);
      setStatus("images");

      // 3. 并发生成图片（控制并发数为 2，使用统一风格）
      const concurrency = 2;
      const totalSlides = initialSlides.length;
      let completedCount = 0;

      // 任务队列
      const queue = initialSlides.map((slide, index) => ({ slide, index }));
      
      const processQueue = async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (!item) break;

          const { slide, index } = item;
          
          try {
            // 添加随机延迟，避免完全同时请求
            await delay(Math.random() * 1000 + 500);
            
            // 传递统一风格主题给图片生成
            const imageUrl = await generateImage(slide.imagePrompt, styleTheme);
            setSlides((prev) =>
              prev.map((s, idx) =>
                idx === index ? { ...s, imageUrl } : s
              )
            );
          } catch (err) {
            console.error(`Failed to generate image for slide ${index + 1}:`, err);
          } finally {
            completedCount++;
            setProgress(10 + (completedCount / totalSlides) * 90);
          }
        }
      };

      // 启动并发任务
      const workers = Array(Math.min(concurrency, totalSlides))
        .fill(null)
        .map(() => processQueue());

      await Promise.all(workers);

      setStatus("done");
      setProgress(100);
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

        // 半透明遮罩层
        slide.addShape("rect", {
          x: 0, y: 0, w: "100%", h: "100%",
          fill: { color: "000000", transparency: 40 },
        });

        if (isFirstSlide || isLastSlide) {
          // 封面/结尾页 - 使用简化配置
          slide.addText(slideData.title || "", {
            x: 0.5, y: 1.5, w: 9, h: 1.5,
            fontSize: 40, fontFace: "Arial", color: "FFFFFF",
            bold: true, align: "center", valign: "middle",
          });
          if (slideData.subtitle) {
            slide.addText(slideData.subtitle, {
              x: 0.5, y: 3.2, w: 9, h: 0.8,
              fontSize: 22, fontFace: "Arial", color: "DDDDDD",
              align: "center", valign: "middle",
            });
          }
          if (slideData.content && !isLastSlide) {
            slide.addText(slideData.content, {
              x: 1, y: 4.2, w: 8, h: 1,
              fontSize: 14, fontFace: "Arial", color: "CCCCCC",
              align: "center", valign: "top",
            });
          }
        } else {
          // 内容页
          slide.addText(slideData.title || "", {
            x: 0.5, y: 0.3, w: 9, h: 0.8,
            fontSize: 28, fontFace: "Arial", color: "FFFFFF",
            bold: true, align: "left", valign: "middle",
          });
          if (slideData.subtitle) {
            slide.addText(slideData.subtitle, {
              x: 0.5, y: 1.0, w: 9, h: 0.5,
              fontSize: 16, fontFace: "Arial", color: "DDDDDD",
              align: "left", valign: "middle",
            });
          }
          const contentY = slideData.subtitle ? 1.6 : 1.2;
          if (slideData.content) {
            slide.addText(slideData.content, {
              x: 0.5, y: contentY, w: 9, h: 1.0,
              fontSize: 12, fontFace: "Arial", color: "CCCCCC",
              align: "left", valign: "top",
            });
          }
          if (slideData.bulletPoints && slideData.bulletPoints.length > 0) {
            const bulletTexts = slideData.bulletPoints.map(point => ({
              text: point,
              options: { 
                bullet: { type: "bullet" as const },
                fontSize: 14, color: "FFFFFF", fontFace: "Arial",
              }
            }));
            slide.addText(bulletTexts, {
              x: 0.5, y: contentY + 1.0, w: 9, h: 3.0,
              valign: "top", paraSpaceAfter: 6,
            });
          }
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
            <span className="px-3 py-1 rounded-full bg-green-50 text-green-600 text-xs font-medium border border-green-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              生成完成
            </span>
          ) : status === "error" ? (
            <span className="px-3 py-1 rounded-full bg-red-50 text-red-600 text-xs font-medium border border-red-200">
              生成中断
            </span>
          ) : (
            <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-600 text-xs font-medium border border-blue-200 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
              AI 思考中
            </span>
          )}
        </div>

        {/* 计时器 */}
        <div className="font-mono text-sm bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 text-purple-600 font-medium">
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
            <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-purple-500 via-blue-500 to-purple-500 rounded-full transition-all duration-500 animate-shimmer"
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

        {/* 网格展示 */}
        {slides.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-20">
            {slides.map((slide, index) => (
              <div 
                key={slide.id} 
                className="animate-fade-in-up" 
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <SlideCard
                  slide={slide}
                  isRegenerating={regeneratingSlides.has(slide.id)}
                  onRegenerate={() => regenerateSlide(slide.id)}
                />
              </div>
            ))}
          </div>
        )}

        {/* 底部浮动操作栏 */}
        {status === "done" && (
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-fade-in-up">
            <div className="bg-white/90 backdrop-blur-xl border border-slate-200 p-2 rounded-2xl shadow-xl flex items-center gap-2">
              <Button
                onClick={exportPptx}
                disabled={isExporting}
                className="h-12 px-8 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold rounded-xl shadow-lg shadow-purple-500/20 transition-all hover:scale-105 disabled:opacity-70 disabled:hover:scale-100 disabled:cursor-wait"
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
