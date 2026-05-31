/**
 * 天机阁 - 分享海报生成器
 * 生成命格批文卡（掌纹/面相通用）
 */
const ShareManager = (() => {

    /**
     * 生成命格卡海报
     * @param {string} type - 'palm' 或 'face'
     * @param {Object} data - 结果数据
     * @param {string} question - 用户问题
     * @returns {Promise<string>} base64 图片
     */
    async function generatePoster(type, data, question) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = 750;
        canvas.height = 1000;

        // 背景渐变（墨黑红）
        const bgGrad = ctx.createLinearGradient(0, 0, 0, 1000);
        bgGrad.addColorStop(0, '#100808');
        bgGrad.addColorStop(0.5, '#1C1010');
        bgGrad.addColorStop(1, '#100808');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, 750, 1000);

        // 顶部红光
        const topGlow = ctx.createRadialGradient(375, 0, 0, 375, 0, 400);
        topGlow.addColorStop(0, 'rgba(168, 32, 26, 0.15)');
        topGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = topGlow;
        ctx.fillRect(0, 0, 750, 400);

        // 顶部金线
        ctx.fillStyle = '#D4AF37';
        ctx.fillRect(0, 0, 750, 4);

        // Logo
        ctx.fillStyle = '#D4AF37';
        ctx.font = '600 24px "STSong", "PingFang SC", serif';
        ctx.textAlign = 'center';
        const subTitle = type === 'palm' ? '天机 · 掌纹命格批文' : '天机 · 面相相理批文';
        ctx.fillText(subTitle, 375, 60);

        // 分割线
        ctx.strokeStyle = 'rgba(212, 175, 55, 0.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(100, 88);
        ctx.lineTo(650, 88);
        ctx.stroke();

        // 命格称号
        ctx.fillStyle = '#D4AF37';
        ctx.font = '700 42px "STSong", "PingFang SC", serif';
        ctx.fillText(data.title, 375, 160);

        // 稀有度
        const stars = '★'.repeat(data.rarity) + '☆'.repeat(5 - data.rarity);
        ctx.fillStyle = '#D4AF37';
        ctx.font = '400 26px sans-serif';
        ctx.fillText(stars, 375, 205);

        ctx.fillStyle = '#A89888';
        ctx.font = '400 16px "PingFang SC", sans-serif';
        ctx.fillText(`主星：${data.star}  ·  命格稀有度 ${data.rarityPercent}%`, 375, 240);

        // 用户问题
        if (question) {
            ctx.fillStyle = '#C8302A';
            ctx.font = '600 22px "STSong", "PingFang SC", serif';
            ctx.fillText(`「${question}」`, 375, 295);
        }

        // 分割线
        ctx.fillStyle = '#9A7B2E';
        ctx.font = '400 14px "PingFang SC", sans-serif';
        ctx.fillText('━━━ 核心批文 ━━━', 375, 345);

        // 批文（去掉HTML标签）
        const conclusionText = (data.conclusion || '').replace(/<[^>]+>/g, '');
        ctx.fillStyle = '#EDE0D4';
        ctx.font = '400 17px "PingFang SC", sans-serif';
        ctx.textAlign = 'left';
        let endY = wrapText(ctx, conclusionText, 90, 385, 570, 30);

        // 证据链（最多展示前2条，节省空间）
        ctx.textAlign = 'center';
        ctx.fillStyle = '#9A7B2E';
        ctx.font = '400 14px "PingFang SC", sans-serif';
        let evY = endY + 40;
        ctx.fillText('━━━ 命格证据 ━━━', 375, evY);
        evY += 35;

        ctx.textAlign = 'left';
        const showEvidences = (data.evidences || []).slice(0, 2);
        showEvidences.forEach(e => {
            ctx.fillStyle = '#D4AF37';
            ctx.font = '600 15px "PingFang SC", sans-serif';
            ctx.fillText(`🎯 ${e.loc}`, 90, evY);
            evY += 26;
            ctx.fillStyle = '#A89888';
            ctx.font = '400 14px "PingFang SC", sans-serif';
            evY = wrapText(ctx, e.meaning, 90, evY, 570, 24) + 20;
        });

        // 底部装饰太极
        ctx.fillStyle = 'rgba(212, 175, 55, 0.06)';
        ctx.font = '180px serif';
        ctx.textAlign = 'center';
        ctx.fillText('☯', 375, 820);

        // 底部 CTA
        ctx.fillStyle = '#A8201A';
        roundRect(ctx, 200, 855, 350, 52, 26);
        ctx.fill();
        ctx.fillStyle = '#EDE0D4';
        ctx.font = '600 19px "STSong", "PingFang SC", serif';
        ctx.fillText('扫码测测你的命格', 375, 888);

        // 底部小字
        ctx.fillStyle = 'rgba(237, 224, 212, 0.3)';
        ctx.font = '12px "PingFang SC", sans-serif';
        ctx.fillText('天机阁 · 娱乐测试 · 理性参考', 375, 945);

        return canvas.toDataURL('image/jpeg', 0.9);
    }

    function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
        const chars = (text || '').split('');
        let line = '';
        let currentY = y;
        for (let i = 0; i < chars.length; i++) {
            const testLine = line + chars[i];
            if (ctx.measureText(testLine).width > maxWidth && line) {
                ctx.fillText(line, x, currentY);
                line = chars[i];
                currentY += lineHeight;
            } else {
                line = testLine;
            }
        }
        ctx.fillText(line, x, currentY);
        return currentY;
    }

    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    async function triggerShare(type, data, question) {
        const posterData = await generatePoster(type, data, question);

        const overlay = document.createElement('div');
        overlay.id = 'share-overlay';
        overlay.innerHTML = `
            <div class="share-modal">
                <div class="share-header">
                    <h3>📜 保存并分享命格卡</h3>
                    <button class="share-close" id="share-close">✕</button>
                </div>
                <div class="share-poster-wrap">
                    <img src="${posterData}" alt="命格卡" class="share-poster-img"/>
                </div>
                <p class="share-tip">长按图片保存到相册，分享到朋友圈或微信群</p>
                <button class="share-done-btn" id="share-done">完成</button>
            </div>
        `;

        if (!document.getElementById('share-styles')) {
            const style = document.createElement('style');
            style.id = 'share-styles';
            style.textContent = `
                #share-overlay {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.9); z-index: 99999;
                    display: flex; align-items: center; justify-content: center;
                    animation: shareFadeIn 0.3s ease;
                }
                @keyframes shareFadeIn { from { opacity: 0; } to { opacity: 1; } }
                .share-modal {
                    background: #1C1010; border-radius: 18px; padding: 24px;
                    width: 90%; max-width: 400px; text-align: center;
                    max-height: 90vh; overflow-y: auto;
                    border: 1px solid rgba(212, 175, 55, 0.3);
                }
                .share-header {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 16px;
                }
                .share-header h3 { color: #D4AF37; margin: 0; font-size: 17px; }
                .share-close {
                    background: none; border: none; color: rgba(237,224,212,0.5);
                    font-size: 24px; cursor: pointer; padding: 0; width: 32px; height: 32px;
                }
                .share-poster-wrap { border-radius: 12px; overflow: hidden; margin-bottom: 12px; }
                .share-poster-img { width: 100%; display: block; border-radius: 12px; }
                .share-tip { color: rgba(237,224,212,0.6); font-size: 14px; margin: 12px 0; line-height: 1.6; }
                .share-done-btn {
                    width: 100%; padding: 14px; border: none; border-radius: 12px;
                    background: linear-gradient(135deg, #A8201A, #C8302A);
                    color: #EDE0D4; font-size: 16px; font-weight: 600; cursor: pointer; margin-top: 8px;
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(overlay);

        return new Promise((resolve) => {
            document.getElementById('share-close').addEventListener('click', () => { overlay.remove(); resolve(false); });
            document.getElementById('share-done').addEventListener('click', () => { overlay.remove(); resolve(true); });
            overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); resolve(false); } });
        });
    }

    return { generatePoster, triggerShare };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ShareManager;
}
