export interface SlideOutline {
  title: string;
  content: string;
  imagePrompt: string;
}

export interface Slide {
  id: string;
  pageNumber: number;
  title: string;
  content: string;
  imageUrl: string;
  imagePrompt: string;
}

export interface OutlineRequest {
  topic: string;
  pageCount: number;
}

export interface OutlineResponse {
  slides: SlideOutline[];
}

export interface ImageRequest {
  prompt: string;
}

export interface ImageResponse {
  imageUrl: string;
}

export interface ExportRequest {
  slides: Slide[];
  title: string;
}

