# 选文送 AI v1.2.0 · 首个公开源码预览版

将网页选中文字交给自己的 AI 工作流：支持通用 JSON POST 接口，以及 DeepSeek Harness 桌面版当前会话草稿。

## 功能

- Chrome / Edge 原生右键交付选文与可撤销的选字辅助。
- 自定义接口、认证头和嵌套 JSON 模板。
- Harness 草稿插入，保留原有文字，由用户手动发送。
- 每台电脑独立生成配对文件，发布包不内置共享密钥。
- 本地状态提示、失败恢复、跨会话 / 草稿修订保护及确认丢失防重。

## 下载

- `webclip-to-ai-v1.2.0.zip`：完整安装包。
- `webclip-to-ai-extension-v1.2.0.zip`：浏览器扩展。
- `harness-webclip-1.2.0.tgz`：Harness 接收插件。
- `webclip-to-ai-source-v1.2.0.zip`：源码项目。
- `SHA256SUMS.txt`：文件校验值。

## 兼容性与验证

Harness 接收插件仅适配 `dsh 0.2.1-rc.2`。实际 CLI 安装、Host 启动、Client 资源交付、认证路由及 11 项真实后台接入检查已通过；这些接入检查的编辑器仍为模拟接口。真实浏览器右键、桌面安装界面和输入框写入受控制环境阻断，尚未完成。请将本版本作为 **Pre-release**。

没有实现图片 OCR、直接写入 Kimi / Gemini 网页或扩展商店发布。实际模型由用户的智能体端配置。
