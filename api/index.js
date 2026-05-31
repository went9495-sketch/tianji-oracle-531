require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const auth = require('../vercel-gemini-auth');

const app = express();

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*';

app.use(cors({
    origin: ALLOWED_ORIGINS,
    methods: ['POST', 'GET', 'OPTIONS'],
    allowedHeaders: ['Content-Type']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(__dirname + '/..'));

// ============================================================
// 请求限流：防止API滥用
// ============================================================
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15分钟
    max: 10, // 最多10次请求
    message: { success: false, error: '请求过于频繁，请稍后再试' },
    standardHeaders: true,
    legacyHeaders: false
});

// ============================================================
// 命格库：紫微14主星（精选10个）
// ============================================================
const DESTINY_PATTERNS = [
    { title: "紫微帝星格", star: "紫微", rarity: 5, keywords: ["领导天赋", "贵人相助", "责任重担"] },
    { title: "天机智囊格", star: "天机", rarity: 4, keywords: ["机敏善谋", "变通灵活", "思虑过深"] },
    { title: "太阳普照格", star: "太阳", rarity: 3, keywords: ["热情开朗", "乐于助人", "易耗心神"] },
    { title: "武曲财星格", star: "武曲", rarity: 4, keywords: ["果断坚毅", "财运亨通", "刚硬难柔"] },
    { title: "天同福星格", star: "天同", rarity: 3, keywords: ["温和随性", "知足常乐", "缺乏冲劲"] },
    { title: "廉贞次桃花格", star: "廉贞", rarity: 4, keywords: ["魅力四射", "情感丰富", "易陷纠葛"] },
    { title: "天府库藏格", star: "天府", rarity: 4, keywords: ["稳重保守", "善于积累", "求稳怕变"] },
    { title: "太阴柔美格", star: "太阴", rarity: 3, keywords: ["细腻敏感", "内敛含蓄", "多愁善感"] },
    { title: "贪狼桃花格", star: "贪狼", rarity: 5, keywords: ["多才多艺", "欲望强烈", "易生波折"] },
    { title: "破军开拓格", star: "破军", rarity: 5, keywords: ["勇于突破", "不畏艰险", "大起大落"] }
];

// ============================================================
// Prompt：掌纹密码
// ============================================================
const PALM_PROMPT = `你是一位精通中国传统相法的资深相师，擅长从掌纹中读取命运线索。

用户上传了手掌照片并提出问题：{question}

你需要从以下命格中选择最匹配的一个：
${DESTINY_PATTERNS.map((p, i) => `${i + 1}. ${p.title}（主星：${p.star}，稀有度${p.rarity}星）`).join('\n')}

**输出要求**：
- pattern_index: 选择的命格编号（1-10）
- conclusion: 80字核心结论（针对用户问题，包含具体建议，可用<span class="highlight">文字</span>高亮关键词）
- reason: 50字判断依据
- evidences: 3条证据（每条含loc掌纹位置、feat特征描述、meaning相法解读）
- advice: 2-3条行动建议

这是趣味娱乐内容，不涉及健康/寿命/婚姻预测。请严格按JSON格式输出。`;

// ============================================================
// Prompt：面相洞察
// ============================================================
const FACE_PROMPT = `你是一位精通中国传统相法的资深相师，擅长从面相中读取命运线索。

用户上传了面部照片并提出问题：{question}

你需要从以下命格中选择最匹配的一个：
${DESTINY_PATTERNS.map((p, i) => `${i + 1}. ${p.title}（主星：${p.star}，稀有度${p.rarity}星）`).join('\n')}

**输出要求**：
- pattern_index: 选择的命格编号（1-10）
- conclusion: 100字综合判定（针对用户问题，含预警与建议）
- evidences: 3条证据（每条含loc面部位置如印堂/命宫、feat特征描述、meaning相法解读）

这是趣味娱乐内容，不涉及健康/寿命/婚姻预测。请严格按JSON格式输出。`;

// ============================================================
// responseSchema
// ============================================================
const PALM_SCHEMA = {
    type: 'object',
    properties: {
        pattern_index: { type: 'integer', minimum: 1, maximum: 10 },
        conclusion: { type: 'string' },
        reason: { type: 'string' },
        evidences: {
            type: 'array',
            maxItems: 3,
            items: {
                type: 'object',
                properties: {
                    loc: { type: 'string' },
                    feat: { type: 'string' },
                    meaning: { type: 'string' }
                },
                required: ['loc', 'feat', 'meaning']
            }
        },
        advice: { type: 'array', items: { type: 'string' } }
    },
    required: ['pattern_index', 'conclusion', 'reason', 'evidences', 'advice']
};

const FACE_SCHEMA = {
    type: 'object',
    properties: {
        pattern_index: { type: 'integer', minimum: 1, maximum: 10 },
        conclusion: { type: 'string' },
        evidences: {
            type: 'array',
            maxItems: 3,
            items: {
                type: 'object',
                properties: {
                    loc: { type: 'string' },
                    feat: { type: 'string' },
                    meaning: { type: 'string' }
                },
                required: ['loc', 'feat', 'meaning']
            }
        }
    },
    required: ['pattern_index', 'conclusion', 'evidences']
};

// ============================================================
// 路由：掌纹密码
// ============================================================
app.post('/api/analyze/palm', apiLimiter, async (req, res, next) => {
    try {
        const authMode = await auth.refreshCredentials();
        if (authMode === 'offline') {
            return res.status(500).json({ success: false, error: '未检测到认证配置' });
        }

        const ai = auth.createAIClient(authMode);
        if (!ai) {
            return res.status(500).json({ success: false, error: 'AI客户端创建失败' });
        }

        const { imageBase64, question } = req.body;
        if (!imageBase64) return res.status(400).json({ error: '未提供图片' });

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const prompt = PALM_PROMPT.replace('{question}', question || '我的整体运势如何？');

        const model = auth.getModel(authMode);
        const response = await ai.models.generateContent({
            model: model,
            contents: [prompt, { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }],
            config: {
                temperature: 0.7,
                responseMimeType: 'application/json',
                responseSchema: PALM_SCHEMA
            }
        });

        const aiData = JSON.parse(response.text);
        const pattern = DESTINY_PATTERNS[aiData.pattern_index - 1];
        const rarityPercent = { 5: 0.8, 4: 2.7, 3: 8.5, 2: 18.0, 1: 35.0 }[pattern.rarity];

        res.json({
            success: true,
            data: {
                title: pattern.title,
                star: pattern.star,
                rarity: pattern.rarity,
                rarityPercent: rarityPercent,
                keywords: pattern.keywords,
                conclusion: aiData.conclusion,
                reason: aiData.reason,
                evidences: aiData.evidences,
                advice: aiData.advice
            }
        });

    } catch (error) {
        next(error); // 传递给统一错误处理中间件
    }
});

// ============================================================
// 路由：面相洞察
// ============================================================
app.post('/api/analyze/face', apiLimiter, async (req, res, next) => {
    try {
        const authMode = await auth.refreshCredentials();
        if (authMode === 'offline') {
            return res.status(500).json({ success: false, error: '未检测到认证配置' });
        }

        const ai = auth.createAIClient(authMode);
        if (!ai) {
            return res.status(500).json({ success: false, error: 'AI客户端创建失败' });
        }

        const { imageBase64, question } = req.body;
        if (!imageBase64) return res.status(400).json({ error: '未提供图片' });

        const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        const prompt = FACE_PROMPT.replace('{question}', question || '我的健康与福泽如何？');

        const model = auth.getModel(authMode);
        const response = await ai.models.generateContent({
            model: model,
            contents: [prompt, { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }],
            config: {
                temperature: 0.7,
                responseMimeType: 'application/json',
                responseSchema: FACE_SCHEMA
            }
        });

        const aiData = JSON.parse(response.text);
        const pattern = DESTINY_PATTERNS[aiData.pattern_index - 1];
        const rarityPercent = { 5: 0.8, 4: 2.7, 3: 8.5, 2: 18.0, 1: 35.0 }[pattern.rarity];

        res.json({
            success: true,
            data: {
                title: pattern.title,
                star: pattern.star,
                rarity: pattern.rarity,
                rarityPercent: rarityPercent,
                keywords: pattern.keywords,
                conclusion: aiData.conclusion,
                evidences: aiData.evidences
            }
        });

    } catch (error) {
        next(error); // 传递给统一错误处理中间件
    }
});

// ============================================================
// 统一错误处理中间件
// ============================================================
app.use((err, req, res, next) => {
    console.error('[Error]', err);
    res.status(500).json({
        success: false,
        error: err.message || '服务器内部错误'
    });
});

if (require.main === module) {
    const PORT = process.env.PORT || 3001;
    app.listen(PORT, () => {
        console.log(`✅ 天机阁服务运行于 http://localhost:${PORT}`);
    });
}

module.exports = app;
