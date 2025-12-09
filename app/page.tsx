"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { TemplateUploader } from "@/components/TemplateUploader";
import { TemplateStyle } from "@/types";

export default function Home() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [pageCount, setPageCount] = useState(8);
  const [isLoading, setIsLoading] = useState(false);
  const [templateStyle, setTemplateStyle] = useState<TemplateStyle | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleGenerate = async () => {
    if (!topic.trim()) return;
    if (isAnalyzing) return; // 等待分析完成

    setIsLoading(true);

    sessionStorage.setItem("ppt-topic", topic);
    sessionStorage.setItem("ppt-pageCount", pageCount.toString());

    // 保存模版风格到 sessionStorage
    if (templateStyle) {
      // 不保存 base64 图片，太大了
      const styleToSave = { ...templateStyle };
      delete styleToSave.templateImageBase64;
      sessionStorage.setItem("ppt-templateStyle", JSON.stringify(styleToSave));
    } else {
      sessionStorage.removeItem("ppt-templateStyle");
    }

    router.push("/generate");
  };

  const handleTemplateAnalyzed = (style: TemplateStyle | null) => {
    setTemplateStyle(style);
  };

  return (
    <main className="min-h-screen relative overflow-hidden flex items-center justify-center bg-background">
      {/* 动态背景层 */}
      <div className="absolute inset-0 z-0 opacity-60">
        <div className="absolute top-0 -left-40 w-96 h-96 bg-emerald-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob" />
        <div className="absolute top-0 -right-40 w-96 h-96 bg-teal-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-2000" />
        <div className="absolute -bottom-40 left-20 w-96 h-96 bg-lime-100 rounded-full mix-blend-multiply filter blur-3xl animate-blob animation-delay-4000" />
      </div>

      <div className="relative z-10 w-full max-w-4xl px-4 py-8">
        <div className="flex flex-col items-center text-center mb-10 animate-fade-in-up">
          <h1 className="text-6xl md:text-7xl font-black tracking-tight mb-6 drop-shadow-sm flex items-center justify-center gap-1">
            <span className="font-serif italic text-transparent bg-clip-text bg-gradient-to-r from-violet-600 via-indigo-600 to-cyan-500 animate-gradient-x filter drop-shadow-lg scale-110 inline-block">神笔</span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 via-teal-400 to-lime-400 animate-gradient-x">PPT</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl leading-relaxed">
            让创意在指尖流淌，一键生成专业级演示文稿。
          </p>
        </div>

        {/* 主功能卡片 */}
        <div className="glass-card rounded-3xl p-8 md:p-10 animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
          <div className="space-y-8">

            {/* 输入区域 */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                创意主题
              </label>
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-200 to-teal-200 rounded-xl opacity-50 group-hover:opacity-100 transition duration-500 blur"></div>
                <Textarea
                  placeholder="描述你的 PPT 主题，越详细越好..."
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="relative min-h-[120px] bg-white border-slate-200 text-lg text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-emerald-500/20 rounded-xl resize-none p-6 shadow-sm"
                />
              </div>

              {/* 快捷标签 */}
              <div className="flex flex-wrap gap-2 pt-2">
                {["人工智能发展史", "探索火星计划", "全球气候变暖", "文艺复兴艺术", "中国传统节日", "大学生职业规划"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setTopic(tag)}
                    className="px-4 py-1.5 text-xs font-medium text-slate-600 bg-white hover:bg-emerald-50 border border-slate-200 hover:border-emerald-200 rounded-full transition-all hover:text-emerald-700 hover:scale-105 shadow-sm"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* 页数选择 */}
            <div className="space-y-3">
              <label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                幻灯片页数
              </label>
              <div className="flex items-center gap-4">
                <Input
                  type="number"
                  min={3}
                  max={20}
                  value={pageCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val)) setPageCount(Math.min(20, Math.max(3, val)));
                  }}
                  className="w-32 bg-white border-slate-200 text-lg font-bold text-center h-12 rounded-xl focus:border-emerald-500 focus:ring-emerald-500/20"
                />
                <span className="text-slate-500 text-sm">页 (3-20)</span>
              </div>
            </div>

            {/* 模版上传 */}
            <TemplateUploader
              onTemplateAnalyzed={handleTemplateAnalyzed}
              isAnalyzing={isAnalyzing}
              setIsAnalyzing={setIsAnalyzing}
            />

            {/* 提交按钮 */}
            <Button
              onClick={handleGenerate}
              disabled={!topic.trim() || isLoading || isAnalyzing}
              className="w-full h-16 text-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 border-0 rounded-2xl shadow-lg shadow-emerald-200/50 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed relative overflow-hidden group"
            >
              {isLoading ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>正在启动引擎...</span>
                </div>
              ) : isAnalyzing ? (
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>正在分析模版...</span>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <span className="relative z-10">开始创作</span>
                  {templateStyle && (
                    <span className="relative z-10 text-sm opacity-80">(使用自定义模版)</span>
                  )}
                  <svg className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                  <div className="absolute inset-0 bg-gradient-to-r from-teal-600 to-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                </div>
              )}
            </Button>
          </div>
        </div>

        {/* 底部版权 */}
        <div className="mt-8 text-center text-xs text-slate-400 animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
          <p>© 2025 神笔PPT</p>
        </div>
      </div>
    </main>
  );
}
