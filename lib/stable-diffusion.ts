// 本地 Stable Diffusion API 集成
// 支持 AUTOMATIC1111 WebUI API

export interface StableDiffusionRequest {
  prompt: string;
  negative_prompt?: string;
  width?: number;
  height?: number;
  steps?: number;
  cfg_scale?: number;
  sampler_name?: string;
  seed?: number;
  batch_size?: number;
  n_iter?: number;
}

export interface StableDiffusionResponse {
  images: string[];  // base64 encoded images
  parameters: any;
  info: string;      // JSON string with generation info
}

// 配置
const SD_API_URL = process.env.NEXT_PUBLIC_SD_API_URL || 'http://localhost:7860';
const SD_API_ENDPOINT = `${SD_API_URL}/sdapi/v1/txt2img`;

export async function generateImageWithSD(
  prompt: string,
  options: Partial<StableDiffusionRequest> = {}
): Promise<string> {
  const defaultOptions: StableDiffusionRequest = {
    prompt: prompt,
    negative_prompt: 'text, letters, signature, watermark, logo, brand, username, words, writing, signature, fuzzy, blurry, ugly, bad quality',
    width: 1024,
    height: 576,
    steps: 20,
    cfg_scale: 7,
    sampler_name: 'DPM++ 2M Karras',
    seed: -1,
    batch_size: 1,
    n_iter: 1,
    ...options
  };

  try {
    const response = await fetch(SD_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(defaultOptions),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Stable Diffusion API error:', errorText);
      throw new Error(`Stable Diffusion API error: ${response.status}`);
    }

    const data: StableDiffusionResponse = await response.json();

    if (!data.images || data.images.length === 0) {
      throw new Error('No images generated');
    }

    // 返回第一张图片的 base64 数据（添加 data:image/png;base64, 前缀）
    return `data:image/png;base64,${data.images[0]}`;
  } catch (error) {
    console.error('Failed to generate image with Stable Diffusion:', error);
    throw error;
  }
}

// 检查 API 是否可用
export async function checkSDApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${SD_API_URL}/`, {
      method: 'GET',
    });
    return response.ok;
  } catch {
    return false;
  }
}

// 获取可用模型列表（如果支持）
export async function getSDModels(): Promise<string[]> {
  try {
    const response = await fetch(`${SD_API_URL}/sdapi/v1/sd-models`);
    if (response.ok) {
      const data = await response.json();
      return data.map((model: any) => model.title || model.model_name);
    }
    return [];
  } catch {
    return [];
  }
}