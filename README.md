This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## 部署与环境变量

本项目在生成大纲与配图时需要 `SILICONFLOW_API_KEY`。请在本地与 Vercel 都配置该变量：

- 本地开发：在项目根目录创建或编辑 `.env.local`，加入：

```
SILICONFLOW_API_KEY=你的SiliconFlow密钥
```

- Vercel 配置：进入项目 Settings → Environment Variables，新增：
  - `Key`: `SILICONFLOW_API_KEY`
  - `Value`: 你的 SiliconFlow API Key
  - `Environment`: 选择 `Production` 与 `Preview`
  - 保存后触发一次重新部署

部署完成后，可通过 `GET /api/health` 进行快速验证：

- 返回 `{ status: "ok", hasApiKey: true }` 表示密钥已生效
- 返回 500 且 `hasApiKey: false` 表示未配置或未生效
