import { SlideOutline } from "@/types";

const siliconFlowApiKey = process.env.SILICONFLOW_API_KEY;

if (!siliconFlowApiKey) {
  console.warn("Warning: SILICONFLOW_API_KEY is not set");
}

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";

// 带重试的 fetch 函数
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(25000),
      });
      
      if (response.status === 503) {
        console.log(`Server busy (503), attempt ${i + 1}, retrying...`);
        await delay(1000 * (i + 1));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${i + 1} failed:`, (error as Error).message);
      await delay(500 * (i + 1));
    }
  }
  
  throw lastError || new Error("Max retries exceeded");
}

export interface GeneratedOutline {
  styleTheme: {
    name: string;
    colorTone: string;
    style: string;
    mood: string;
  };
  slides: SlideOutline[];
}

export async function generateOutline(
  topic: string,
  pageCount: number
): Promise<GeneratedOutline> {
  if (!siliconFlowApiKey) {
    throw new Error("SILICONFLOW_API_KEY is not configured");
  }

  const prompt = `生成PPT大纲，主题：${topic}

【重要】必须生成正好 ${pageCount} 页，不多不少！

要求：
- 第1页：封面页
- 第2到第${pageCount - 1}页：内容页
- 第${pageCount}页：总结/感谢页

每页必须包含：title、subtitle、content(2句话)、bulletPoints(3个要点)、imagePrompt(英文背景描述)。

【关键】imagePrompt 必须根据页面具体内容生成具体的画面描述，不要总是抽象几何！
例如：
- 历史主题 -> 复古风格，具体的历史场景，旧照片质感
- 科技主题 -> 未来感，具体的科技设备，赛博朋克风格
- 自然主题 -> 具体的风景照片，森林，海洋，天空
- 商业主题 -> 办公室场景，握手，会议，极简商务风

确定一个统一视觉风格(styleTheme)，所有imagePrompt必须包含相同的colorTone和style。

返回JSON格式（slides数组必须有${pageCount}个元素）：
{"styleTheme":{"name":"风格名","colorTone":"warm vintage","style":"photorealistic","mood":"historical"},"slides":[{"title":"...","imagePrompt":"Vintage photograph of 19th century factory, sepia tone, detailed machinery, 16:9"}]}

只返回JSON，不要其他内容。`;

  try {
    const response = await fetchWithRetry(
      `${SILICONFLOW_BASE_URL}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${siliconFlowApiKey}`,
        },
        body: JSON.stringify({
          model: "Qwen/Qwen2.5-7B-Instruct",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.7,
          max_tokens: 2048,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SiliconFlow API error:", errorText);
      throw new Error(`SiliconFlow API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText);
    let slides = parsed.slides as SlideOutline[];
    
    // 校验并修正页数
    if (slides.length < pageCount) {
      console.warn(`AI only generated ${slides.length} slides, expected ${pageCount}. Padding...`);
      // 补充缺少的页面
      while (slides.length < pageCount) {
        const lastSlide = slides[slides.length - 1];
        slides.push({
          title: slides.length === pageCount - 1 ? "总结与展望" : `第${slides.length + 1}部分`,
          subtitle: "",
          content: "内容待补充",
          bulletPoints: ["要点1", "要点2", "要点3"],
          imagePrompt: lastSlide?.imagePrompt || "blue gradient minimalist abstract background, geometric patterns, no text, 16:9",
        });
      }
    } else if (slides.length > pageCount) {
      console.warn(`AI generated ${slides.length} slides, expected ${pageCount}. Trimming...`);
      slides = slides.slice(0, pageCount);
    }
    
    return {
      styleTheme: parsed.styleTheme || {
        name: "Professional Blue",
        colorTone: "deep blue and white gradient",
        style: "minimalist corporate",
        mood: "professional"
      },
      slides
    };
  } catch (error) {
    console.error("SiliconFlow API error:", error);
    throw error;
  }
}

// 延迟函数
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 图片生成函数 - 使用 SiliconFlow Kolors
export async function generateImage(
  prompt: string, 
  styleTheme?: { colorTone: string; style: string; mood: string }
): Promise<string> {
  if (!siliconFlowApiKey) {
    throw new Error("SILICONFLOW_API_KEY is not configured");
  }

  // 构建简洁的提示词
  const stylePrefix = styleTheme 
    ? `${styleTheme.colorTone}, ${styleTheme.style} style.`
    : "high quality, professional style.";
  
  // 移除 "Abstract background" 和 "Geometric patterns" 这种强限制
  // 让 prompt 更加自由，只保留必要的质量控制
  const enhancedPrompt = `${stylePrefix} ${prompt}. No text, no faces, 16:9, high resolution, cinematic lighting.`;

  const maxRetries = 5;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(`${SILICONFLOW_BASE_URL}/images/generations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${siliconFlowApiKey}`,
        },
        body: JSON.stringify({
          model: "Kwai-Kolors/Kolors",
          prompt: enhancedPrompt,
          image_size: "1024x576",
          num_inference_steps: 20, // 减少步数加快速度
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 429) {
        const waitTime = 3000 * (attempt + 1);
        console.log(`Rate limited, waiting ${waitTime/1000}s...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SiliconFlow Image API error:", errorText);
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.images?.[0]?.url) {
        return data.images[0].url;
      }
      if (data.data?.[0]?.url) {
        return data.data[0].url;
      }
      if (data.data?.[0]?.b64_json) {
        return `data:image/png;base64,${data.data[0].b64_json}`;
      }

      throw new Error("No image in response");
    } catch (error) {
      console.error(`Image generation attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) throw error;
      await delay(2000 * (attempt + 1));
    }
  }
  
  throw new Error("Max retries exceeded");
}
