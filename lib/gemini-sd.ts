// 使用本地 Stable Diffusion API 替代 SiliconFlow

import { generateImageWithSD, checkSDApiStatus } from './stable-diffusion';

// 导出与原 gemini.ts 相同的接口，但使用本地 API
export async function generateImage(
  prompt: string,
  styleTheme?: { colorTone: string; style: string; mood: string }
): Promise<string> {
  // 检查本地 API 是否可用
  const isApiAvailable = await checkSDApiStatus();
  if (!isApiAvailable) {
    throw new Error('本地 Stable Diffusion API 不可用，请确保服务已启动');
  }

  // 构建提示词，适配 Stable Diffusion
  let enhancedPrompt = prompt;

  if (styleTheme) {
    // 将风格主题转换为 Stable Diffusion 友好的格式
    const styleElements = [];

    // 颜色主题
    if (styleTheme.colorTone) {
      styleElements.push(styleTheme.colorTone);
    }

    // 风格
    if (styleTheme.style) {
      styleElements.push(styleTheme.style);
    }

    // 情绪
    if (styleTheme.mood) {
      styleElements.push(styleTheme.mood);
    }

    enhancedPrompt = `${styleElements.join(', ')}, ${prompt}`;
  }

  // 添加质量相关的提示词
  enhancedPrompt += ', high quality, professional, clean design';

  // 调用本地 Stable Diffusion API
  return await generateImageWithSD(enhancedPrompt, {
    steps: 20,
    cfg_scale: 7.5,
    width: 1024,
    height: 576,
    sampler_name: 'DPM++ 2M Karras'
  });
}

// 保持其他函数不变
export { generateOutline, OutlineRequest, OutlineResponse } from './gemini';