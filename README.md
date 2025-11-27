# 神笔PPT

AI 驱动的 PPT 生成工具，输入主题一键生成精美演示文稿。

🔗 **在线体验**：https://shenbippt.netlify.app/

## ✨ 功能特点

- 📝 **智能大纲生成** - 基于 AI 自动生成演示文稿结构
- 🎨 **自动配图** - AI 生成与内容匹配的精美配图
- 📊 **一键导出** - 导出为标准 PPTX 格式文件
- 🎯 **简单易用** - 只需输入主题即可生成完整 PPT

## 🛠️ 技术栈

- **框架**：Next.js 16 + React 19 + TypeScript
- **样式**：Tailwind CSS 4
- **AI 服务**：SiliconFlow API（Qwen 大模型 + Kolors 图像生成）
- **PPT 生成**：pptxgenjs
- **UI 组件**：Radix UI + Lucide Icons
- **部署**：Netlify / Vercel

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone https://github.com/yizhengyuan/shenbippt.git
cd shenbippt
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

在项目根目录创建 `.env.local` 文件：

```
SILICONFLOW_API_KEY=你的API密钥
```

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000) 即可使用。

## 📦 部署

### 环境变量配置

在部署平台（Netlify/Vercel）配置以下环境变量：

- `SILICONFLOW_API_KEY`：SiliconFlow API 密钥

### 部署到 Netlify

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/yizhengyuan/shenbippt)

### 部署到 Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yizhengyuan/shenbippt)

## 📄 License

MIT
