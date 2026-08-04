# AI 聚合聊天

一个纯前端、完全本地运行的 AI 聚合聊天网页。无需后端、无需注册，直接打开即可使用。

- 💬 **聊天记录存储在本地**：所有对话保存在浏览器的 `localStorage`，刷新页面不丢失。
- 🔌 **支持多种厂商 API 接入**：可添加任意多个厂商，支持 OpenAI 兼容接口、Anthropic (Claude) 与 Google Gemini。
- 📤📥 **导出 / 导入**：一键把全部聊天记录（含厂商配置）导出为 JSON 文件，随时导入恢复。

## 功能特性

- 多对话管理：新建 / 切换 / 重命名 / 删除 / 清空
- 流式输出（打字机效果），支持中途停止生成
- 每家厂商可独立配置名称、Base URL、API Key、多个模型（逗号分隔）
- 聊天时按厂商 → 模型 下拉快捷切换
- 数据 100% 保存在本地，不上传任何服务器

## 支持的 API 类型

| 类型 | 说明 | 典型场景 |
| --- | --- | --- |
| OpenAI 兼容 | `POST /chat/completions`，可自定义 Base URL | OpenAI、DeepSeek、Moonshot、OpenRouter、国产大模型等 |
| Anthropic | Claude Messages API | Claude 系列 |
| Gemini | `streamGenerateContent` | Google Gemini 系列 |

> 绝大多数国产大模型（DeepSeek、Qwen、豆包等）都是 OpenAI 兼容接口，仅需填写对应的 Base URL 和 API Key 即可接入。

## 使用方法

1. 打开页面：直接用浏览器打开 `index.html`，或运行本地静态服务器

   ```bash
   cd chat
   npx serve .
   ```

2. 点击左下角 **⚙ 设置** → **添加厂商**，选择接口类型，填写名称、Base URL、API Key 和模型。
3. 回到主界面，选择厂商和模型，在下方输入消息发送。

### API Key 安全提示

API Key 仅保存在你本地浏览器的 `localStorage` 中，不会上传到任何服务器。请勿在共享电脑上保存敏感密钥，导出文件也请妥善保管。

## 导出 / 导入

- 点击 **⬇ 导出记录**，将下载一个 JSON 文件（包含厂商配置 + 全部对话）。
- 点击 **⬆ 导入记录**，选择之前导出的 JSON 文件即可完整恢复。

## 技术栈

- 原生 HTML / CSS / JavaScript，无任何第三方依赖
- 使用浏览器 `fetch` API 流式请求各家大模型接口
- 数据持久化基于 `localStorage`

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Enter` | 发送消息 |
| `Shift + Enter` | 换行 |
| `Ctrl + N` | 新建对话 |