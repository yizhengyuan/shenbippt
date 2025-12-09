import { SlideOutline, TemplateStyle } from "@/types";

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
  pageCount: number,
  templateStyle?: TemplateStyle
): Promise<GeneratedOutline> {
  if (!siliconFlowApiKey) {
    throw new Error("SILICONFLOW_API_KEY is not configured");
  }

  // 根据是否有模版风格，构建不同的 prompt
  const templateStyleSection = templateStyle ? `

【重要】用户已上传模版，请严格按照以下风格生成内容：
- 主色调: ${templateStyle.primaryColor}
- 辅助色: ${templateStyle.secondaryColor}
- 背景风格: ${templateStyle.backgroundColor}
- 布局风格: ${templateStyle.layout}
- 标题风格: ${templateStyle.titleStyle}
- 整体调性: ${templateStyle.mood}
- 视觉元素: ${templateStyle.visualElements}
- 配图风格提示: ${templateStyle.imageStylePrompt}

所有 imagePrompt 都必须包含以下风格描述: "${templateStyle.imageStylePrompt}"
` : "";

  const prompt = `生成PPT大纲，主题：${topic}

【重要】必须生成正好 ${pageCount} 页，不多不少！
${templateStyleSection}
要求：
- 第1页：封面页
- 第2到第${pageCount - 1}页：内容页
- 第${pageCount}页：总结/感谢页（标题可以是"总结"、"展望未来"、"谢谢"等，不是"第X页"）

每页必须包含：title、subtitle、content(4-6句话，详细阐述)、bulletPoints(4-6个要点)、imagePrompt(英文背景描述)。

内容要求：
- content字段：必须包含4-6个完整的句子，详细解释该页主题
- bulletPoints字段：必须包含4-6个具体要点，每个要点可以是短语或短句
- 内容要丰富、具体，避免空洞的描述

【极其重要】所有幻灯片必须使用完全相同的背景！
就像真正的PPT模板一样，每页背景必须一模一样！

规则：
1. 只生成一个通用的背景描述，所有页面都使用相同的背景
2. 不要试图根据每页内容变化背景
3. 背景应该简洁、通用，适合各种内容

【极其重要】背景必须是85%以上纯白色，主题元素只能在最边缘5-10%区域！
背景设计铁律：
1. 整个背景85-90%必须是纯白色（#FFFFFF）或极浅的灰色
2. 主题元素严格限制在四周边缘（最多10%宽度）
3. 任何装饰都不能延伸到距离边缘1.5英寸（约3.8厘米）以内
4. 装饰元素必须是半透明的，透明度80%以上
5. 决不允许使用渐变色覆盖整个背景

【强制要求】backgroundImage描述必须包含：
- "85% pure white space" 或 "90% white background"
- "decorations only within 10% of edges"
- "transparent/slight decorative elements"
- "no gradients covering the center"
- "clean white space for text"

根据主题选择背景元素：
- 科技主题：电路板纹理、数据流线条、二进制代码、科技感网格（只在边缘）
- 医疗主题：DNA双螺旋、医学符号（十字+蛇）、心电图波形、分子结构（边缘装饰）
- 教育主题：书本堆叠、毕业帽、公式符号、铅笔钢笔图案（边缘摆放）
- 商务主题：城市天际线、上升趋势图、货币符号、握手剪影（边缘装饰）
- 历史主题：时间轴、古老建筑轮廓、历史文档纹理、复古地图（边缘）
- 环保主题：叶子脉络、地球轮廓、水滴纹理、可再生能源图标（边缘）
- 艺术主题：画笔颜料、音符、舞蹈剪影、建筑线条（边缘）
- 食物主题：餐具轮廓、食材图案、厨房元素（边缘）

【关键】backgroundImage必须：
1. 明确说明是什么主题的背景
2. 列出具体的主题相关元素
3. 强调只在边缘显示
4. 确保中央大面积留白

严格示例（必须包含这些关键词）：
主题："人工智能发展" →
"90% pure white background with very subtle 5% transparent blue circuit patterns confined to leftmost 8% of slide, tiny semi-transparent neural network nodes only in bottom right corner within 2 inches of edge, binary code extremely faint watermark on top 5% border only, absolutely no gradients, center 85% completely pure white (#FFFFFF), minimalist technology theme, vast empty space for text, 16:9"

错误示例（会出现问题）：
❌ "Blue gradient background" - 禁止渐变
❌ "Circuit patterns across the slide" - 禁止延伸到中间
❌ "Tech elements scattered around" - 禁止随意分布
❌ "Dark background with..." - 禁止深色
${templateStyle ? `styleTheme 必须与用户模版风格保持一致，使用以下值：
- colorTone: "${templateStyle.imageStylePrompt.split(',')[0] || templateStyle.mood}"
- style: "${templateStyle.mood}"
- mood: "${templateStyle.mood}"` : ""}

返回JSON格式（slides数组必须有${pageCount}个元素）：
注意：所有slides使用相同的backgroundImage（通用背景描述）！

【极其重要】每个slide的title必须是实际的内容标题，不是"封面"、"内容页"这种占位符！

正确示例（主题："人工智能的发展"）：
{"styleTheme":{"name":"Tech Professional","colorTone":"white with technology elements","style":"modern tech","mood":"professional"},"backgroundImage":"Clean white background with light blue circuit board patterns along left edge, small neural network icons in corners, binary code watermark on top edge, 70% central area pure white, technology theme, 16:9","slides":[
  {"title":"人工智能：从概念到现实","subtitle":"从图灵测试到ChatGPT的技术演进","content":"人工智能的概念最早可以追溯到1950年，当时艾伦·图灵提出了著名的图灵测试。经过七十多年的发展，人工智能经历了从规则系统到机器学习，再到深度学习的三次重大飞跃。如今的大型语言模型如GPT系列，已经能够进行自然对话、写作代码、分析数据等复杂任务。未来的人工智能将更加智能、通用，并与人类社会深度融合。","bulletPoints":["图灵测试定义了机器智能的基本标准","专家系统时代：1980年代的知识推理","机器学习革命：2000年代的数据驱动","深度学习爆发：2010年后的神经网络突破","大模型时代：2020年代的通用人工智能"],"imagePrompt":"Clean white background with light blue circuit board patterns..."},
  {"title":"机器学习的核心原理","subtitle":"算法、数据与计算力的完美结合","content":"机器学习的核心是通过算法让计算机从数据中学习规律，而不需要人工编程。监督学习使用标注数据训练模型，无监督学习发现数据中的隐藏模式，强化学习通过试错优化决策。深度学习作为机器学习的分支，通过多层神经网络自动提取特征，在图像识别、自然语言处理等领域取得了革命性成果。","bulletPoints":["监督学习：分类与回归问题的主流方法","无监督学习：聚类、降维与异常检测","强化学习：智能体与环境的交互学习","深度学习：卷积神经网络处理图像","循环神经网络处理序列数据","Transformer架构改变游戏规则"],"imagePrompt":"Clean white background with light blue circuit board patterns..."}
]}

另一个例子（主题："环保生活方式"）：
{"styleTheme":{"name":"Eco Modern","colorTone":"white with green accents","style":"environmental","mood":"fresh and natural"},"backgroundImage":"Pure white background with subtle green leaf patterns along bottom edge, small recycling symbols in corners, light wave patterns on left side, 75% central area pure white, environmental theme, 16:9","slides":[...]}

错误示例（不要使用）：
{"slides":[
  {"title":"封面"},  // ❌ 错误！
  {"title":"内容页1"}, // ❌ 错误！
  {"title":"内容页2"} // ❌ 错误！
]}

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

  // 构建简洁的提示词 - 简化以提高成功率
  const stylePrefix = styleTheme
    ? `${styleTheme.colorTone}, ${styleTheme.style}.`
    : "professional, clean.";

  // 简化提示词，减少复杂度
  const enhancedPrompt = `${stylePrefix} ${prompt}. 16:9, white background, minimal design.`;

  const maxRetries = 3; // 减少重试次数，快速失败

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
          num_inference_steps: 10, // 进一步减少步数
          guidance_scale: 7.5, // 添加引导比例
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (response.status === 429) {
        const waitTime = 3000 * (attempt + 1);
        console.log(`Rate limited, waiting ${waitTime / 1000}s...`);
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
