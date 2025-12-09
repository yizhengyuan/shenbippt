# 本地 Stable Diffusion API 部署指南

本指南将帮助你在本地部署 Stable Diffusion API，作为 SiliconFlow 的替代方案。

## 系统要求

### 硬件要求
- **GPU**: NVIDIA GPU（推荐 RTX 3060 或更高，8GB+ 显存）
- **内存**: 16GB+ RAM
- **存储**: 至少 50GB 可用空间（用于模型和输出）

### 软件要求
- **操作系统**: Linux、macOS 或 Windows（需要 WSL2）
- **Docker**: 最新版本（20.10+）
- **Docker Compose**: 最新版本
- **NVIDIA Docker Toolkit**: [安装指南](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html)

## 快速开始

### 1. 准备环境

```bash
# 克隆或下载项目
cd /Users/justin/Desktop/shenbippt

# 确保脚本可执行
chmod +x deploy-stable-diffusion.sh
```

### 2. 部署 Stable Diffusion

```bash
# 运行部署脚本
./deploy-stable-diffusion.sh
```

首次运行会自动下载模型文件（约 5GB），可能需要 10-30 分钟。

### 3. 验证部署

打开浏览器访问：http://localhost:7860

你应该能看到 Stable Diffusion WebUI 界面。

### 4. 配置项目使用本地 API

```bash
# 复制环境配置文件
cp .env.local.stable-diffusion .env.local
```

重启 Next.js 开发服务器：
```bash
npm run dev
```

## 高级配置

### 自定义模型

1. 下载模型到 `models/ldm` 目录：
   - Stable Diffusion 1.5: `models/ldm/stable-diffusion-v1-5`
   - SDXL: `models/ldm/stable-diffusion-xl`
   - 自定义 LoRA: `models/Lora`

2. 在 WebUI 的模型选择器中选择你的模型。

### 性能优化

1. **xformers 加速**（默认已启用）
2. **模型半精度**：在 WebUI 设置中启用
3. **内存优化**：在 WebUI 设置中调整 `--medvram` 或 `--lowvram`

### 生产部署

```bash
# 使用 docker-compose.prod.yml
docker-compose -f docker-compose.stable-diffusion.yml -f docker-compose.prod.yml up -d
```

## 故障排除

### 常见问题

1. **GPU 不被识别**
   ```bash
   # 检查 NVIDIA Docker 支持
   docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
   ```

2. **内存不足**
   - 使用 `--lowvram` 参数
   - 减小批量大小

3. **生成速度慢**
   - 使用 `--xformers` 加速
   - 减少采样步数
   - 使用更快的采样器（如 `DPM++ 2M Karras`）

### 查看日志

```bash
# 查看实时日志
docker logs -f stable-diffusion-api

# 查看最近的日志
docker logs stable-diffusion-api --tail 100
```

## API 使用示例

### 基本请求

```javascript
const response = await fetch('http://localhost:7860/sdapi/v1/txt2img', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A beautiful sunset over the ocean',
    negative_prompt: 'blurry, low quality',
    width: 1024,
    height: 576,
    steps: 20,
    cfg_scale: 7,
    sampler_name: 'DPM++ 2M Karras'
  })
});
```

### 批量生成

```javascript
const response = await fetch('http://localhost:7860/sdapi/v1/txt2img', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'A cat',
    batch_size: 4,  // 生成 4 张图片
    n_iter: 2      // 重复 2 次（总共 8 张）
  })
});
```

## 切换回 SiliconFlow

如果需要切换回 SiliconFlow：

```bash
# 编辑 .env.local
# 注释掉或删除 NEXT_PUBLIC_IMAGE_GENERATION_SOURCE=local
```

## 安全注意事项

1. **防火墙设置**：确保 7860 端口只对本地开放
2. **API 认证**：生产环境建议添加 API Key 认证
3. **资源限制**：设置适当的 GPU 和内存限制

## 成本对比

| 方案 | 初始成本 | 运营成本 | 速率限制 | 隐私性 |
|------|----------|----------|----------|--------|
| SiliconFlow | $0 | 按次付费 | 有 | 中 |
| 本地 SD | $500-2000（硬件） | 电费 | 无 | 高 |

## 支持与社区

- [AUTOMATIC1111 GitHub](https://github.com/AUTOMATIC1111/stable-diffusion-webui)
- [Stable Diffusion 官方文档](https://stability.ai/)
- [社区 Discord](https://discord.gg/stable-diffusion)

## 更新日志

- 2024-12-09: 初始版本支持本地 Stable Diffusion API
- 支持 AUTOMATIC1111 WebUI API
- 自动回退到 SiliconFlow（如果配置）