/**
 * 标准化认证模板 - Vercel + Gemini 多模式认证
 *
 * 支持四种模式：
 * 1. offline - 离线模式，不调用AI
 * 2. adc - 本地AI模式，自动识别ADC认证
 * 3. wif - Vercel OIDC + GCP WIF（生产环境推荐）
 * 4. legacy - 传统服务账号私钥
 * 5. api_key - Gemini API Key（快速接入）
 *
 * 使用方法：
 * const auth = require('./vercel-gemini-auth');
 * const authMode = await auth.refreshCredentials();
 * const ai = auth.createAIClient(authMode);
 */

const fs = require('fs');

// ============================================================
// 配置项（从环境变量读取）
// ============================================================
const CONFIG = {
    // GCP 配置
    GCP_PROJECT_ID: process.env.GCP_PROJECT_ID || 'project-e3177fe6-42e6-4e28-9e1',
    GCP_PROJECT_NUMBER: process.env.GCP_PROJECT_NUMBER,
    GCP_SERVICE_ACCOUNT_EMAIL: process.env.GCP_SERVICE_ACCOUNT_EMAIL,
    GCP_WORKLOAD_IDENTITY_POOL_ID: process.env.GCP_WORKLOAD_IDENTITY_POOL_ID,
    GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID: process.env.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID,
    GCP_LOCATION: process.env.GCP_LOCATION || 'global',

    // 传统私钥配置
    GOOGLE_CLIENT_EMAIL: process.env.GOOGLE_CLIENT_EMAIL,
    GOOGLE_PRIVATE_KEY: process.env.GOOGLE_PRIVATE_KEY,

    // API Key 配置
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,

    // 模型配置（支持环境自动切换）
    MODEL_LOCAL: process.env.MODEL_LOCAL || 'gemini-2.5-pro',
    MODEL_PRODUCTION: process.env.MODEL_PRODUCTION || 'gemini-3.1-flash-lite',
    MODEL: process.env.MODEL, // 如果设置了 MODEL，会覆盖上面两个

    // 认证模式优先级（可自定义）
    // 本地开发推荐: offline,adc,local_model（离线规则最优先）
    // 生产环境推荐: wif,offline
    AUTH_PRIORITY: (process.env.AUTH_PRIORITY || 'offline,adc,wif,legacy,local_model').split(','),
};

// ============================================================
// 认证函数
// ============================================================

/**
 * 动态刷新认证凭据
 * 按照优先级尝试各种认证方式，返回可用的模式
 *
 * @returns {Promise<string>} 认证模式：'wif' | 'adc' | 'api_key' | 'legacy' | 'offline'
 */
async function refreshCredentials() {
    for (const mode of CONFIG.AUTH_PRIORITY) {
        try {
            if (mode === 'wif' && await tryWifAuth()) {
                console.log('[Auth] ✅ WIF 模式（Vercel OIDC + GCP WIF）');
                return 'wif';
            }
            if (mode === 'adc' && await tryAdcAuth()) {
                console.log('[Auth] ✅ ADC 模式（本地 Application Default Credentials）');
                return 'adc';
            }
            if (mode === 'api_key' && tryApiKeyAuth()) {
                console.log('[Auth] ✅ API Key 模式（Gemini API Key）');
                return 'api_key';
            }
            if (mode === 'legacy' && tryLegacyAuth()) {
                console.log('[Auth] ✅ Legacy 模式（服务账号私钥）');
                return 'legacy';
            }
        } catch (error) {
            console.log(`[Auth] ⚠️  ${mode} 模式失败: ${error.message}`);
        }
    }

    console.log('[Auth] ℹ️  所有认证模式均不可用，使用离线模式');
    return 'offline';
}

/**
 * 尝试 WIF 认证（Vercel OIDC + GCP WIF）
 */
async function tryWifAuth() {
    // 检查必需的环境变量
    if (!CONFIG.GCP_PROJECT_NUMBER ||
        !CONFIG.GCP_SERVICE_ACCOUNT_EMAIL ||
        !CONFIG.GCP_WORKLOAD_IDENTITY_POOL_ID ||
        !CONFIG.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID) {
        return false;
    }

    // 尝试导入 @vercel/oidc（可能不存在）
    let getVercelOidcToken;
    try {
        ({ getVercelOidcToken } = require('@vercel/oidc'));
    } catch (e) {
        return false;
    }

    // 获取 Vercel OIDC Token
    const token = await getVercelOidcToken();
    fs.writeFileSync('/tmp/oidc-token.txt', token);

    // 生成 WIF 配置文件
    const wifConfig = {
        type: "external_account",
        audience: `//iam.googleapis.com/projects/${CONFIG.GCP_PROJECT_NUMBER}/locations/global/workloadIdentityPools/${CONFIG.GCP_WORKLOAD_IDENTITY_POOL_ID}/providers/${CONFIG.GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID}`,
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        token_url: "https://sts.googleapis.com/v1/token",
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${CONFIG.GCP_SERVICE_ACCOUNT_EMAIL}:generateAccessToken`,
        credential_source: {
            file: "/tmp/oidc-token.txt",
            format: { type: "text" }
        }
    };
    fs.writeFileSync('/tmp/wif-config.json', JSON.stringify(wifConfig));

    // 设置 ADC 环境变量
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/tmp/wif-config.json';
    return true;
}

/**
 * 尝试 ADC 认证（本地 gcloud auth application-default login）
 */
async function tryAdcAuth() {
    // ADC 不需要额外配置，SDK 会自动从以下位置查找：
    // 1. GOOGLE_APPLICATION_CREDENTIALS 环境变量指向的文件
    // 2. gcloud 的默认凭据文件
    // 3. GCE/Cloud Run 的元数据服务器

    // 检查是否有 GCP_PROJECT_ID（ADC 需要知道项目ID）
    if (!CONFIG.GCP_PROJECT_ID) {
        return false;
    }

    // 检查是否在本地环境（非 Vercel）
    if (process.env.VERCEL) {
        return false;
    }

    // ADC 模式不需要额外设置，直接返回 true
    // SDK 会自动尝试从本地环境读取凭据
    return true;
}

/**
 * 尝试 API Key 认证
 */
function tryApiKeyAuth() {
    return !!CONFIG.GEMINI_API_KEY;
}

/**
 * 尝试 Legacy 认证（传统服务账号私钥）
 */
function tryLegacyAuth() {
    return !!(CONFIG.GOOGLE_CLIENT_EMAIL && CONFIG.GOOGLE_PRIVATE_KEY);
}

/**
 * 创建 GoogleGenAI 客户端实例
 *
 * @param {string} authMode - 认证模式
 * @returns {Object|null} GoogleGenAI 实例，如果是 offline 模式则返回 null
 */
function createAIClient(authMode) {
    // 尝试导入 @google/genai
    let GoogleGenAI;
    try {
        ({ GoogleGenAI } = require('@google/genai'));
    } catch (e) {
        console.error('[Auth] ❌ 未安装 @google/genai，请运行: npm install @google/genai');
        return null;
    }

    if (authMode === 'offline') {
        return null;
    }

    if (authMode === 'api_key') {
        return new GoogleGenAI({
            apiKey: CONFIG.GEMINI_API_KEY
        });
    }

    // wif, adc, legacy 都使用 Vertex AI
    const config = {
        vertexai: true,
        project: CONFIG.GCP_PROJECT_ID,
        location: CONFIG.GCP_LOCATION
    };

    if (authMode === 'legacy') {
        config.credentials = {
            client_email: CONFIG.GOOGLE_CLIENT_EMAIL,
            private_key: CONFIG.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n')
        };
    }
    // wif 和 adc 模式不需要传 credentials，SDK 会自动从 ADC 读取

    return new GoogleGenAI(config);
}

/**
 * 获取当前环境应该使用的模型
 *
 * @param {string} authMode - 当前认证模式
 * @returns {string} 模型名称
 */
function getModel(authMode) {
    // 如果设置了 MODEL，直接使用（覆盖所有）
    if (CONFIG.MODEL) {
        return CONFIG.MODEL;
    }

    // 根据认证模式自动选择
    if (authMode === 'adc') {
        // 本地开发模式，使用高性能模型
        return CONFIG.MODEL_LOCAL;
    } else {
        // 生产环境（wif/legacy/api_key），使用经济模型
        return CONFIG.MODEL_PRODUCTION;
    }
}

/**
 * 获取认证状态信息（用于调试和前端显示）
 *
 * @returns {Object} 认证状态信息
 */
function getAuthStatus() {
    return {
        priority: CONFIG.AUTH_PRIORITY,
        available_modes: {
            wif: !!(CONFIG.GCP_PROJECT_NUMBER && CONFIG.GCP_SERVICE_ACCOUNT_EMAIL),
            adc: !!CONFIG.GCP_PROJECT_ID && !process.env.VERCEL,
            api_key: !!CONFIG.GEMINI_API_KEY,
            legacy: !!(CONFIG.GOOGLE_CLIENT_EMAIL && CONFIG.GOOGLE_PRIVATE_KEY),
        },
        project_id: CONFIG.GCP_PROJECT_ID,
        location: CONFIG.GCP_LOCATION,
        model_local: CONFIG.MODEL_LOCAL,
        model_production: CONFIG.MODEL_PRODUCTION,
        model_override: CONFIG.MODEL,
    };
}

// ============================================================
// 导出
// ============================================================
module.exports = {
    refreshCredentials,
    createAIClient,
    getModel,
    getAuthStatus,
    CONFIG,
};
