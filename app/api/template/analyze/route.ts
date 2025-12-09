import { NextRequest, NextResponse } from "next/server";
import { TemplateStyle, TemplateAnalyzeResponse } from "@/types";

const siliconFlowApiKey = process.env.SILICONFLOW_API_KEY;

export async function POST(request: NextRequest): Promise<NextResponse<TemplateAnalyzeResponse>> {
    try {
        if (!siliconFlowApiKey) {
            return NextResponse.json(
                { success: false, error: "API 密钥未配置" },
                { status: 500 }
            );
        }

        const { imageBase64 } = await request.json();

        if (!imageBase64) {
            return NextResponse.json(
                { success: false, error: "未提供图片" },
                { status: 400 }
            );
        }

        // 使用 Qwen VL 多模态模型分析图片
        const prompt = `你是一个专业的 PPT 设计分析师。请仔细分析这张 PPT 模版截图，提取其视觉设计风格。

请返回 JSON 格式的分析结果，包含以下字段：

{
  "primaryColor": "主色调的十六进制代码，如 #1E40AF",
  "secondaryColor": "辅助色的十六进制代码，如 #60A5FA",
  "backgroundColor": "背景类型: dark / light / gradient",
  "layout": "布局风格: centered / left-aligned / card-based / split",
  "titleStyle": "标题风格: bold / elegant / minimal / decorative",
  "mood": "整体调性，用英文描述，如 corporate, creative, academic, playful, modern, vintage",
  "visualElements": "视觉元素特点，用英文描述，如 geometric shapes, organic curves, photo-heavy, minimalist, icon-based",
  "imageStylePrompt": "用于生成相似风格配图的英文提示词，约20-30词，描述色调、风格、视觉元素，不要包含具体内容"
}

只返回 JSON，不要其他内容。`;

        // 提取 base64 数据部分
        const base64Data = imageBase64.includes(",")
            ? imageBase64.split(",")[1]
            : imageBase64;

        const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${siliconFlowApiKey}`,
            },
            body: JSON.stringify({
                model: "Qwen/Qwen2-VL-72B-Instruct",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Data}`,
                                },
                            },
                            {
                                type: "text",
                                text: prompt,
                            },
                        ],
                    },
                ],
                temperature: 0.3,
                max_tokens: 1024,
            }),
            signal: AbortSignal.timeout(30000),
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("SiliconFlow VL API error:", errorText);
            return NextResponse.json(
                { success: false, error: "图片分析失败，请重试" },
                { status: 500 }
            );
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content || "";

        // 解析 JSON
        const cleanedText = text
            .replace(/```json\n?/g, "")
            .replace(/```\n?/g, "")
            .trim();

        let parsed;
        try {
            parsed = JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse VL response:", cleanedText);
            return NextResponse.json(
                { success: false, error: "无法解析模版风格" },
                { status: 500 }
            );
        }

        // 构建 TemplateStyle
        const templateStyle: TemplateStyle = {
            primaryColor: parsed.primaryColor || "#1E40AF",
            secondaryColor: parsed.secondaryColor || "#60A5FA",
            backgroundColor: parsed.backgroundColor || "light",
            layout: parsed.layout || "centered",
            titleStyle: parsed.titleStyle || "bold",
            mood: parsed.mood || "corporate",
            visualElements: parsed.visualElements || "minimalist",
            imageStylePrompt: parsed.imageStylePrompt || "professional corporate style, clean design, subtle gradients",
            templateImageBase64: imageBase64,
        };

        return NextResponse.json({
            success: true,
            templateStyle,
        });

    } catch (error) {
        console.error("Template analyze error:", error);
        return NextResponse.json(
            { success: false, error: "分析过程出错" },
            { status: 500 }
        );
    }
}
