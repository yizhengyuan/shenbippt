"use client";

import { useState } from "react";
import { Slide } from "@/types";

interface SlideThumbnailProps {
  slide: Slide;
  isSelected: boolean;
  isLoading?: boolean;
  onClick: () => void;
  onRegenerate?: () => void;
}

export function SlideThumbnail({
  slide,
  isSelected,
  isLoading = false,
  onClick,
  onRegenerate
}: SlideThumbnailProps) {
  const [imageError, setImageError] = useState(false);

  return (
    <div
      className={`relative group cursor-pointer transition-all duration-200 ${
        isSelected
          ? 'ring-2 ring-emerald-500 ring-offset-2 scale-105'
          : 'hover:scale-102 hover:shadow-lg'
      }`}
      onClick={onClick}
    >
      {/* 缩略图容器 */}
      <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden shadow-sm border border-slate-200">
        {slide.imageUrl && !imageError ? (
          <img
            src={slide.imageUrl}
            alt={`Slide ${slide.pageNumber}`}
            className="w-full h-full object-cover"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-slate-100 to-slate-200">
            <span className="text-slate-400 text-sm">
              {imageError ? '图片加载失败' : '生成中...'}
            </span>
          </div>
        )}

        {/* 加载遮罩 */}
        {isLoading && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center">
            <svg className="animate-spin h-6 w-6 text-emerald-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}

        {/* 页码标签 */}
        <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-md">
          {slide.pageNumber}
        </div>

        {/* 标题遮罩（底部） */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent p-3">
          <h3 className="text-white text-sm font-medium line-clamp-2 leading-tight">
            {slide.title}
          </h3>
        </div>
      </div>

      {/* 重新生成按钮 */}
      {onRegenerate && isSelected && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRegenerate();
          }}
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 hover:bg-white text-slate-600 hover:text-emerald-600 p-1.5 rounded-md shadow-sm"
          title="重新生成"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      )}
    </div>
  );
}