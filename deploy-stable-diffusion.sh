#!/bin/bash

echo "🚀 部署 Stable Diffusion API 服务..."

# 检查 Docker 是否安装
if ! command -v docker &> /dev/null; then
    echo "❌ Docker 未安装，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose 未安装，请先安装 Docker Compose"
    exit 1
fi

# 检查 NVIDIA Docker 支持
if ! docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi &> /dev/null; then
    echo "⚠️  NVIDIA Docker 支持未检测到，CPU 模式会很慢"
    echo "请安装 NVIDIA Docker Toolkit："
    echo "https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/install-guide.html"
    read -p "是否继续？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
fi

# 创建必要的目录
echo "📁 创建必要的目录..."
mkdir -p models/ldm
mkdir -p models/vae
mkdir -p outputs/txt2img-images
mkdir -p outputs/img2img-images

# 下载 .env 文件（如果不存在）
if [ ! -f .env.stable-diffusion ]; then
    echo "📝 .env.stable-diffusion 已存在"
fi

# 启动服务
echo "🐳 启动 Stable Diffusion 容器..."
docker-compose -f docker-compose.stable-diffusion.yml up -d

# 等待服务启动
echo "⏳ 等待服务启动（可能需要几分钟下载模型）..."
sleep 10

# 检查服务状态
if curl -s http://localhost:7860 > /dev/null; then
    echo "✅ Stable Diffusion API 启动成功！"
    echo "📍 API 地址: http://localhost:7860"
    echo "📍 Web UI: http://localhost:7860"
    echo ""
    echo "📊 查看日志："
    echo "  docker logs -f stable-diffusion-api"
    echo ""
    echo "🛑 停止服务："
    echo "  docker-compose -f docker-compose.stable-diffusion.yml down"
else
    echo "❌ 服务启动失败，查看日志："
    docker logs stable-diffusion-api
fi