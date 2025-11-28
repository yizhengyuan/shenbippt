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

