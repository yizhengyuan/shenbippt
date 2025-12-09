"use client";

import { useState, useCallback, useRef } from "react";
import { TemplateStyle } from "@/types";

interface TemplateUploaderProps {
    onTemplateAnalyzed: (style: TemplateStyle | null) => void;
    isAnalyzing: boolean;
    setIsAnalyzing: (v: boolean) => void;
}

export function TemplateUploader({
    onTemplateAnalyzed,
    isAnalyzing,
    setIsAnalyzing
}: TemplateUploaderProps) {
    const [mode, setMode] = useState<"auto" | "custom">("auto");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [analyzedStyle, setAnalyzedStyle] = useState<TemplateStyle | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 将文件转换为 Base64
    const fileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    // 分析模版
    const analyzeTemplate = async (base64: string) => {
        setIsAnalyzing(true);
        setError(null);

        try {
            const response = await fetch("/api/template/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64: base64 }),
            });

            if (!response.ok) {
                throw new Error("模版分析失败");
            }

            const data = await response.json();

            if (data.success && data.templateStyle) {
                setAnalyzedStyle(data.templateStyle);
                onTemplateAnalyzed(data.templateStyle);
            } else {
                throw new Error(data.error || "无法识别模版风格");
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "分析失败");
            onTemplateAnalyzed(null);
        } finally {
            setIsAnalyzing(false);
        }
    };

    // 处理文件选择
    const handleFileSelect = async (file: File) => {
        setError(null);

        // 支持的文件类型
        const imageTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
        const docTypes = [
            "application/vnd.openxmlformats-officedocument.presentationml.presentation", // pptx
            "application/pdf"
        ];

        if (imageTypes.includes(file.type)) {
            // 图片直接预览和分析
            const base64 = await fileToBase64(file);
            setPreviewUrl(base64);
            await analyzeTemplate(base64);
        } else if (docTypes.includes(file.type)) {
            // PPTX/PDF - 提示用户截图
            setError("暂不支持直接解析 PPTX/PDF 文件，请上传模版的截图");
            // 未来可以在服务端使用 pdf2pic 或 libreoffice 转换
        } else {
            setError("不支持的文件格式，请上传图片 (PNG, JPG, WebP)");
        }
    };

    // 拖拽处理
    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, []);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    // 点击上传
    const handleClick = () => {
        fileInputRef.current?.click();
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFileSelect(file);
    };

    // 清除模版
    const clearTemplate = () => {
        setPreviewUrl(null);
        setAnalyzedStyle(null);
        setError(null);
        onTemplateAnalyzed(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    // 切换模式
    const handleModeChange = (newMode: "auto" | "custom") => {
        setMode(newMode);
        if (newMode === "auto") {
            clearTemplate();
        }
    };

    return (
        <div className="space-y-4">
            <label className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
                风格模版
            </label>

            {/* 模式选择 */}
            <div className="flex gap-3">
                <button
                    onClick={() => handleModeChange("auto")}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all text-sm font-medium ${mode === "auto"
                            ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI 自动设计
                    </div>
                </button>
                <button
                    onClick={() => handleModeChange("custom")}
                    className={`flex-1 py-3 px-4 rounded-xl border-2 transition-all text-sm font-medium ${mode === "custom"
                            ? "border-purple-500 bg-purple-50 text-purple-700"
                            : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                        }`}
                >
                    <div className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        上传我的模版
                    </div>
                </button>
            </div>

            {/* 上传区域 */}
            {mode === "custom" && (
                <div className="animate-fade-in">
                    {!previewUrl ? (
                        <div
                            onClick={handleClick}
                            onDrop={handleDrop}
                            onDragOver={handleDragOver}
                            className="relative border-2 border-dashed border-slate-300 hover:border-purple-400 rounded-xl p-8 text-center cursor-pointer transition-all hover:bg-purple-50/50 group"
                        >
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/png,image/jpeg,image/webp,image/gif"
                                onChange={handleInputChange}
                                className="hidden"
                            />

                            <div className="flex flex-col items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
                                    <svg className="w-6 h-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-slate-700">
                                        拖拽或点击上传模版截图
                                    </p>
                                    <p className="text-xs text-slate-400 mt-1">
                                        支持 PNG、JPG、WebP 格式
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="relative">
                            {/* 预览图 */}
                            <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                <img
                                    src={previewUrl}
                                    alt="模版预览"
                                    className="w-full h-auto max-h-48 object-contain bg-slate-100"
                                />

                                {/* 分析中遮罩 */}
                                {isAnalyzing && (
                                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                                        <div className="flex items-center gap-2 text-purple-600">
                                            <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                            </svg>
                                            <span className="text-sm font-medium">AI 分析中...</span>
                                        </div>
                                    </div>
                                )}

                                {/* 删除按钮 */}
                                <button
                                    onClick={clearTemplate}
                                    className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>

                            {/* 分析结果 */}
                            {analyzedStyle && !isAnalyzing && (
                                <div className="mt-3 p-3 bg-purple-50 rounded-xl border border-purple-100">
                                    <div className="flex items-center gap-2 text-purple-700 text-sm font-medium mb-2">
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        风格识别成功
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        <span className="px-2 py-1 bg-white rounded-md text-xs text-slate-600 border border-purple-200">
                                            {analyzedStyle.mood}
                                        </span>
                                        <span className="px-2 py-1 bg-white rounded-md text-xs text-slate-600 border border-purple-200">
                                            {analyzedStyle.layout}
                                        </span>
                                        <span className="px-2 py-1 bg-white rounded-md text-xs text-slate-600 border border-purple-200">
                                            {analyzedStyle.titleStyle}
                                        </span>
                                        <span
                                            className="px-2 py-1 rounded-md text-xs text-white border"
                                            style={{ backgroundColor: analyzedStyle.primaryColor }}
                                        >
                                            主色调
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* 错误信息 */}
                    {error && (
                        <div className="mt-3 p-3 bg-red-50 rounded-xl border border-red-100 text-red-600 text-sm flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            {error}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
