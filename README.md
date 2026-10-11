# 个人作品集 · AI 协作开发实例

> 这是一个 **AI 协作开发作品集**，包含 4 个用 AI 工具（Claude / Codex 类）作为主力开发搭档完成的实际项目。
> 涵盖 AI Agent 应用、前端 UI、移动端交互等多个场景，展示了从需求拆解 → 提示词工程 → 迭代调优 → 交付落地的完整流程。

---

## 📂 项目导航

| # | 项目 | 类型 | 技术栈 | 一句话简介 |
|---|------|------|--------|------------|
| 🌟 | [**qisili-ai**](./qisili-ai/) | AI Agent / 角色扮演 | Vanilla JS + DeepSeek API | 齐司礼角色 AI 聊天系统，5 模块 prompt 拆分 + 三层记忆 |
| 🎬 | [**ai-movie-emotion-studio**](./ai-movie-emotion-studio/) | AI 创作工具 | HTML/CSS/JS（单文件） | AI 电影情绪创作工作台，分镜/情绪/脚本一站式生成 |
| 📚 | [**grammar-camp**](./grammar-camp/) | 教育应用 / 移动端 H5 | HTML/CSS/JS（单文件） | 英语语法训练营 App，移动端优先的交互式学习工具 |
| 📋 | [**m1-survey**](./m1-survey/) | 表单 / 问卷系统 | HTML/CSS/JS（单文件） | M1 需求澄清问卷，4 路分支自适应问卷 |

> 💡 **重点推荐**：前两个项目最能体现 **"使用 AI 开发工具指挥 AI 进行代码撰写"** 的能力，建议优先打开查看。

---

## 🛠️ 统一的 AI 开发流程（贯穿所有项目）

每个项目都遵循以下工作流：

1. **需求拆解**：先把需求拆成"用户故事 + 验收标准"，再让 AI 写代码
2. **提示词工程**：把需求写成结构化 prompt（含角色、约束、示例、输出格式）
3. **小步快跑**：分段让 AI 实现，避免一次让 AI 写大段代码导致不可控
4. **人工把关**：每个模块生成后人工 review，不合理的地方指出具体问题让 AI 重写
5. **测试用例驱动**：用真实场景的输入测试 AI 输出，记录"翻车案例"作为 prompt 优化的依据
6. **重构而非补丁**：发现设计层面的问题就让 AI 重构而不是打补丁

---

## 🎯 与岗位要求的对标

| 岗位要求 | 对应项目 / 能力 |
|---------|---------------|
| 推动 AI 能力在实际业务场景中的落地 | qisili-ai（虚拟陪伴场景）、AI 电影情绪创作工作台（创作场景）|
| 使用 AI 工具完成开发任务 | 所有项目均通过 AI 协作完成 |
| 负责基于大模型的应用开发 | qisili-ai（DeepSeek API 集成、prompt 工程、记忆系统）|
| 参与简单前端页面或管理后台开发 | 所有项目均含前端实现，UI 设计独立完成 |
| 使用 claude code、codex 等 AI 开发工具指挥 AI 进行代码撰写 | 完整的"指挥 AI 写代码"工作流见 qisili-ai/README.md |
| 具备完整的系统开发思路 | qisili-ai 的 5 模块 prompt 拆分 + 三层记忆架构 |
| 擅长开发语言不限 | 主力 JavaScript / HTML / CSS，Python 工具脚本辅助 |

---

## 📌 项目状态

- ✅ 代码已落地、可运行
- ✅ 每个项目有独立 README 说明 AI 协作过程
- ⚠️ 部分项目为原型阶段，暂未做深度性能优化（已在各自 README 中标注）

---

## 🔒 Security / 隐私说明

- 本作品集中**所有项目**均为**纯前端应用**，无需后端、无数据库
- 用户的 API Key 均为**运行时自行输入**，存于浏览器 `localStorage`，**不上传任何服务器**
- 本仓库**不包含**任何真实 API Key、聊天记录、用户数据或使用历史
- 代码中所有 `sk-xxx` 均为 placeholder（占位符），不指向真实凭证
- `.gitignore` 已配置 `sk-*`、`*.json`、`*history*`、`*memory*` 等兜底规则

> **架构说明**：本作品集聚焦于**前端 AI 集成与 Prompt 工程**的能力展示，纯前端架构便于读者直接打开体验。
> For **production** deployment, API requests should be routed through a backend service to protect credentials and enable rate limiting / usage monitoring.

---

## 📫 联系

- GitHub: [@Liu17826](https://github.com/Liu17826)
- 项目内有问题或建议欢迎提 Issue

---

> **致 HR / 面试官**：本作品集的所有项目源代码、prompt 设计、迭代记录均公开透明。每个项目的 README 都附带了"AI 协作流程复盘"，真实展示了"指挥 AI 写代码"的实际过程，而非事后包装。