import { SlideOutline } from "@/types";

const siliconFlowApiKey = process.env.SILICONFLOW_API_KEY;

if (!siliconFlowApiKey) {
  console.warn("Warning: SILICONFLOW_API_KEY is not set");
}

const SILICONFLOW_BASE_URL = "https://api.siliconflow.cn/v1";

// 带重试的 fetch 函数（支持 503 重试）
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 5
): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(120000), // 120秒超时
      });
      
      // 如果是 503 错误，等待后重试
      if (response.status === 503) {
        console.log(`Server busy (503), attempt ${i + 1}, retrying...`);
        await new Promise(resolve => setTimeout(resolve, 2000 * (i + 1)));
        continue;
      }
      
      return response;
    } catch (error) {
      lastError = error as Error;
      console.log(`Attempt ${i + 1} failed:`, (error as Error).message);
      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
  
  throw lastError || new Error("Max retries exceeded");
}

export async function generateOutline(
  topic: string,
  pageCount: number
): Promise<SlideOutline[]> {
  if (!siliconFlowApiKey) {
    throw new Error("SILICONFLOW_API_KEY is not configured");
  }

  const prompt = `你是一个专业的PPT大纲生成助手。请根据以下主题生成一个${pageCount}页的PPT大纲。

主题：${topic}

要求：
1. 生成正好${pageCount}页的内容
2. 第一页应该是标题页/封面
3. 最后一页应该是总结或感谢页
4. 每页包含一个标题和简短的内容要点
5. 为每页生成一个适合的图片描述（英文），用于AI生成配图

请以JSON格式返回，格式如下：
{
  "slides": [
    {
      "title": "页面标题",
      "content": "页面内容要点（简短，2-3句话）",
      "imagePrompt": "English description for image generation, be specific and descriptive, include style keywords like: professional, modern, minimalist, colorful"
    }
  ]
}

只返回JSON，不要包含其他文字或markdown代码块标记。`;

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
          model: "Qwen/Qwen2.5-72B-Instruct",
          messages: [
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.7,
          max_tokens: 4096,
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
    return parsed.slides as SlideOutline[];
  } catch (error) {
    console.error("SiliconFlow API error:", error);
    throw error;
  }
}

// 延迟函数
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function generateImage(prompt: string): Promise<string> {
  if (!siliconFlowApiKey) {
    throw new Error("SILICONFLOW_API_KEY is not configured");
  }

  const enhancedPrompt = `Professional presentation slide background. ${prompt}. Style: modern, clean, minimalist design, suitable for presentation, no text, high quality, 16:9 aspect ratio, vibrant colors.`;

  const maxRetries = 10;
  
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
          num_inference_steps: 25,
        }),
        signal: AbortSignal.timeout(60000),
      });

      // 429 速率限制 - 等待后重试
      if (response.status === 429) {
        const waitTime = 5000 * (attempt + 1); // 5s, 10s, 15s...
        console.log(`Rate limited (429), waiting ${waitTime/1000}s before retry ${attempt + 1}...`);
        await delay(waitTime);
        continue;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error("SiliconFlow Image API error:", errorText);
        throw new Error(`SiliconFlow Image API error: ${response.status}`);
      }

      const data = await response.json();
      console.log("Image generation response:", JSON.stringify(data, null, 2));
      
      // SiliconFlow 返回图片 URL
      if (data.images && data.images.length > 0) {
        return data.images[0].url;
      }
      
      // 备用格式
      if (data.data && data.data.length > 0) {
        if (data.data[0].url) {
          return data.data[0].url;
        }
        if (data.data[0].b64_json) {
          return `data:image/png;base64,${data.data[0].b64_json}`;
        }
      }

      throw new Error("No image generated");
    } catch (error) {
      console.error(`Image generation attempt ${attempt + 1} failed:`, error);
      if (attempt === maxRetries - 1) {
        throw error;
      }
      await delay(3000 * (attempt + 1));
    }
  }
  
  throw new Error("Max retries exceeded for image generation");
}
