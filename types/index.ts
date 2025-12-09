export interface SlideOutline {
  title: string;
  subtitle?: string;
  content: string;
  bulletPoints?: string[];
  imagePrompt: string;
}

export interface Slide {
  id: string;
  pageNumber: number;
  title: string;
  subtitle?: string;
  content: string;
  bulletPoints?: string[];
  imageUrl: string;
  imagePrompt: string;
}

// 统一的PPT风格主题
export interface StyleTheme {
  name: string;
  colorTone: string;  // 如 "blue and white", "dark gradient"
  style: string;      // 如 "corporate", "minimalist", "creative"
  mood: string;       // 如 "professional", "energetic", "calm"
}

export interface OutlineRequest {
  topic: string;
  pageCount: number;
}

export interface OutlineResponse {
  slides: SlideOutline[];
  styleTheme: StyleTheme;
  backgroundImage?: string;  // 统一的背景图片描述
}

export interface ImageRequest {
  prompt: string;
  styleTheme?: StyleTheme;
}

export interface ImageResponse {
  imageUrl: string;
}

export interface ExportRequest {
  slides: Slide[];
  title: string;
}

// 用户上传模版分析结果
export interface TemplateStyle {
  // 视觉风格
  primaryColor: string;      // 主色调，如 "#1E40AF"
  secondaryColor: string;    // 辅助色，如 "#60A5FA"
  backgroundColor: string;   // 背景色调，如 "dark" | "light" | "gradient"

  // 布局风格
  layout: "centered" | "left-aligned" | "card-based" | "split";
  titleStyle: "bold" | "elegant" | "minimal" | "decorative";

  // 整体调性
  mood: string;              // 如 "corporate", "creative", "academic", "playful"
  visualElements: string;    // 如 "geometric shapes", "organic curves", "photo-heavy"

  // 用于配图生成的描述
  imageStylePrompt: string;  // 如 "minimalist blue gradient, corporate style, clean lines"

  // 原始模版图片 (base64)
  templateImageBase64?: string;
}

// 模版分析请求
export interface TemplateAnalyzeRequest {
  imageBase64: string;  // 模版图片的 base64
}

// 模版分析响应
export interface TemplateAnalyzeResponse {
  success: boolean;
  templateStyle?: TemplateStyle;
  error?: string;
}

