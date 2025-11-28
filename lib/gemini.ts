import { SlideOutline } from "@/types";

const siliconFlowApiKey = process.env.SILICONFLOW_API_KEY;
const modelScopeApiKey = process.env.MODELSCOPE_API_KEY;

if (!siliconFlowApiKey) {
  console.warn("Warning: SILICONFLOW_API_KEY is not set");
}

if (!modelScopeApiKey) {
  console.warn("Warning: MODELSCOPE_API_KEY is not set, Z-Image will not be available");
}

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";
const MODELSCOPE_API_URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis";

// 带重试的 fetch 函数（支持 503 重试）
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
        signal: AbortSignal.timeout(25000), // 25秒超时，留足够余量
      });
      
      // 如果是 503 错误，等待后重试
      if (response.status === 503) {
        console.log(`Server busy (503), attempt ${i + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${i + 1} failed:`, (error as Error).message);
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 500 * (i + 1)));
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

  const prompt = `生成${pageCount}页PPT大纲，主题：${topic}

要求：第一页是封面，最后页是总结。每页包含title、subtitle、content(2句话)、bulletPoints(3个要点)、imagePrompt(英文背景描述)。

确定一个统一视觉风格(styleTheme)，所有imagePrompt必须包含相同的colorTone和style。

返回JSON格式：
{"styleTheme":{"name":"风格名","colorTone":"blue gradient","style":"minimalist","mood":"professional"},"slides":[{"title":"标题","subtitle":"副标题","content":"内容","bulletPoints":["要点1","要点2","要点3"],"imagePrompt":"[colorTone] [style] abstract background, geometric patterns, no text, 16:9"}]}

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
          model: "Qwen/Qwen2.5-7B-Instruct", // 使用更快的7B模型
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 2048, // 减少token数量加快响应
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("SiliconFlow API error response:", errorText);
      throw new Error(`SiliconFlow API error: ${response.status}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";

    // 清理可能的 markdown 代码块标记
    const cleanedText = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const parsed = JSON.parse(cleanedText);
    return {
      styleTheme: parsed.styleTheme || {
        name: "Professional Blue",
        colorTone: "deep blue and white gradient",
        style: "minimalist corporate",
        mood: "professional"
      },
      slides: parsed.slides as SlideOutline[]
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

// Z-Image (通义万相) 图片生成 - 更快的模型
async function generateImageWithZImage(prompt: string): Promise<string | null> {
  if (!modelScopeApiKey) {
    console.log("ModelScope API key not configured, skipping Z-Image");
    return null;
  }

  try {
    console.log("Trying Z-Image (DashScope) for faster generation...");
    
    // 使用阿里云 DashScope API (通义万相)
    const response = await fetch(MODELSCOPE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${modelScopeApiKey}`,
        "X-DashScope-Async": "enable", // 异步模式
      },
      body: JSON.stringify({
        model: "wanx-v1", // 通义万相模型
        input: {
          prompt: prompt,
        },
        parameters: {
          size: "1024*576",
          n: 1,
          style: "<auto>",
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("DashScope API error:", errorText);
      return null;
    }

    const data = await response.json();
    console.log("DashScope response:", JSON.stringify(data, null, 2));
    
    // 异步任务，需要轮询获取结果
    if (data.output?.task_id) {
      const taskId = data.output.task_id;
      const imageUrl = await pollDashScopeTask(taskId);
      return imageUrl;
    }
    
    // 同步返回的情况
    if (data.output?.results?.[0]?.url) {
      return data.output.results[0].url;
    }

    return null;
  } catch (error) {
    console.error("Z-Image generation failed:", error);
    return null;
  }
}

// 轮询 DashScope 异步任务
async function pollDashScopeTask(taskId: string, maxAttempts = 30): Promise<string | null> {
  const taskUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
  
  for (let i = 0; i < maxAttempts; i++) {
    await delay(1000); // 每秒查询一次
    
    try {
      const response = await fetch(taskUrl, {
        headers: {
          "Authorization": `Bearer ${modelScopeApiKey}`,
        },
      });
      
      if (!response.ok) continue;
      
      const data = await response.json();
      const status = data.output?.task_status;
      
      if (status === "SUCCEEDED") {
        const imageUrl = data.output?.results?.[0]?.url;
        if (imageUrl) {
          console.log("Z-Image generation succeeded!");
          return imageUrl;
        }
      } else if (status === "FAILED") {
        console.error("Z-Image task failed:", data);
        return null;
      }
      // PENDING 或 RUNNING 状态继续等待
    } catch (error) {
      console.error("Poll error:", error);
    }
  }
  
  console.error("Z-Image task timeout");
  return null;
}

// SiliconFlow 图片生成（备用方案）
async function generateImageWithSiliconFlow(prompt: string): Promise<string> {
  if (!siliconFlowApiKey) {
    throw new Error("SILICONFLOW_API_KEY is not configured");
  }

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
          prompt: prompt,
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
        console.error("SiliconFlow API error:", errorText);
        throw new Error(`SiliconFlow API error: ${response.status}`);
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
      console.error(`SiliconFlow attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) throw error;
      await delay(2000 * (attempt + 1));
    }
  }
  
  throw new Error("Max retries exceeded");
}

// 主图片生成函数 - 优先使用 Z-Image，失败则回退到 SiliconFlow
export async function generateImage(prompt: string, styleTheme?: { colorTone: string; style: string; mood: string }): Promise<string> {
  // 构建统一风格的增强提示词
  const stylePrefix = styleTheme 
    ? `${styleTheme.colorTone} color scheme, ${styleTheme.style} design style, ${styleTheme.mood} atmosphere.`
    : "deep blue and white gradient, minimalist corporate design style, professional atmosphere.";
  
  const enhancedPrompt = `Abstract presentation slide background. ${stylePrefix} ${prompt}. Use consistent color palette, abstract geometric patterns, soft gradients, no text, no human faces, clean visual style, high quality, 16:9 aspect ratio.`;

  // 1. 首先尝试 Z-Image（更快）
  const zImageResult = await generateImageWithZImage(enhancedPrompt);
  if (zImageResult) {
    return zImageResult;
  }

  // 2. 回退到 SiliconFlow
  console.log("Falling back to SiliconFlow...");
  return generateImageWithSiliconFlow(enhancedPrompt);
}
