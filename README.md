# 天机阁 TianjiOracle

AI 东方命理趣味洞察 —— 掌纹密码 · 面相洞察

## 产品定位

融合传统相术美学与现代AI，提供趣味命理体验：
- **掌纹密码**：上传手掌照片，解读你的命格批文
- **面相洞察**：上传面部照片，生成你的相理报告

每次测算都会生成一张专属"命格卡"，含命格称号、稀有度、证据链与批文。

## 技术栈

- **前端**：Vanilla HTML/CSS/JavaScript
- **后端**：Node.js + Express (Vercel Serverless)
- **AI引擎**：Google Gemini 3.1 Flash-Lite
- **认证**：Vercel OIDC + GCP Workload Identity Federation

## 本地运行

```bash
npm install
npm start
```

访问 `http://localhost:3000`

## Vercel 部署

配置以下环境变量：
- `GCP_PROJECT_ID`
- `GCP_PROJECT_NUMBER`
- `GCP_SERVICE_ACCOUNT_EMAIL`
- `GCP_WORKLOAD_IDENTITY_POOL_ID`
- `GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID`

## 娱乐声明

本应用为趣味娱乐性质，所有内容均为AI创作，仅供娱乐参考，
不构成任何命理、医疗、投资建议。请相信科学，理性参考。

---

© 2026 天机阁 · 娱乐测试 · 理性参考
