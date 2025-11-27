"use client";

import { Slide } from "@/types";
import { Button } from "@/components/ui/button";

interface SlideCardProps {
  slide: Slide;
  isRegenerating: boolean;
  onRegenerate: () => void;
}

export function SlideCard({ slide, isRegenerating, onRegenerate }: SlideCardProps) {
  return (
    <div className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-sm transition-all duration-300 hover:border-purple-300 hover:shadow-xl hover:-translate-y-1">
      {/* 页码标签 */}
      <div className="absolute top-3 left-3 z-20 px-2.5 py-1 bg-white/90 backdrop-blur-md rounded-lg text-xs font-mono font-bold text-slate-700 border border-slate-200 shadow-sm">
        #{slide.pageNumber.toString().padStart(2, '0')}
      </div>

      {/* 图片预览区 */}
      <div className="relative aspect-video bg-slate-100 overflow-hidden">
        {slide.imageUrl ? (
          <>
            <img
              src={slide.imageUrl}
              alt={slide.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-60 group-hover:opacity-70 transition-opacity" />
          </>
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-shimmer" style={{ backgroundSize: '200% 100%' }} />
            <div className="w-12 h-12 rounded-full bg-white shadow-sm flex items-center justify-center mb-3 relative z-10">
              <svg className="w-6 h-6 text-slate-400 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-xs text-slate-400 relative z-10 font-medium">AI 正在绘制...</span>
          </div>
        )}
        
        {/* 内容覆盖层 */}
        <div className="absolute inset-0 p-5 flex flex-col justify-end z-10">
          <h3 className="text-white font-bold text-lg line-clamp-1 mb-2 drop-shadow-md group-hover:text-purple-100 transition-colors">
            {slide.title}
          </h3>
          <p className="text-slate-200 text-xs line-clamp-2 leading-relaxed opacity-90 group-hover:opacity-100 transition-opacity drop-shadow-sm">
            {slide.content}
          </p>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <Button
          onClick={onRegenerate}
          disabled={isRegenerating}
          variant="ghost"
          size="sm"
          className="w-full h-9 text-xs font-medium text-slate-500 hover:text-purple-600 hover:bg-purple-50 transition-all rounded-lg group/btn"
        >
          {isRegenerating ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              重绘中...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 group-hover/btn:rotate-180 transition-transform duration-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              重新生成配图
            </span>
          )}
        </Button>
      </div>
    </div>
  );
}
