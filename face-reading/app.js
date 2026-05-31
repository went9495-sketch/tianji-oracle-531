/**
 * 面相洞察 - 核心逻辑
 */
document.addEventListener('DOMContentLoaded', () => {
    let state = {
        imageUploaded: false,
        imageData: null,
        question: '',
        resultData: null
    };

    const dom = {
        uploadArea: document.getElementById('upload-area'),
        imageInput: document.getElementById('image-input'),
        previewImage: document.getElementById('preview-image'),
        uploadPlaceholder: document.getElementById('upload-placeholder'),
        qBtns: document.querySelectorAll('.q-btn'),
        customQuestion: document.getElementById('custom-question'),
        btnAnalyze: document.getElementById('btn-analyze'),
        screens: {
            input: document.getElementById('screen-input'),
            loading: document.getElementById('screen-loading'),
            result: document.getElementById('screen-result')
        }
    };

    init();

    function init() {
        dom.uploadArea.addEventListener('click', () => dom.imageInput.click());
        dom.imageInput.addEventListener('change', handleImageUpload);
        dom.btnAnalyze.addEventListener('click', startAnalysis);

        dom.qBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                dom.qBtns.forEach(b => b.classList.remove('selected'));
                e.target.classList.add('selected');
                dom.customQuestion.value = '';
                state.question = e.target.textContent;
                checkReady();
            });
        });

        dom.customQuestion.addEventListener('input', (e) => {
            if (e.target.value.trim()) {
                dom.qBtns.forEach(b => b.classList.remove('selected'));
                state.question = e.target.value;
            } else {
                state.question = '';
            }
            checkReady();
        });

        document.getElementById('btn-share').addEventListener('click', handleShare);
        document.getElementById('btn-restart').addEventListener('click', handleRestart);
        document.getElementById('btn-unlock').addEventListener('click', handleUnlock);
    }

    function handleImageUpload(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => {
            state.imageData = ev.target.result;
            dom.previewImage.src = ev.target.result;
            dom.previewImage.style.display = 'block';
            dom.uploadPlaceholder.style.display = 'none';
            state.imageUploaded = true;
            checkReady();
        };
        reader.readAsDataURL(file);
    }

    function checkReady() {
        dom.btnAnalyze.disabled = !(state.imageUploaded && state.question);
    }

    async function startAnalysis() {
        if (!state.imageUploaded || !state.question) return;
        switchScreen('loading');

        const loadingTexts = [
            "正在勘察五官比例...",
            "锁定印堂、命宫、地阁...",
            "比对十二宫相理谱...",
            "结合所问凝结相理批文..."
        ];

        let idx = 0;
        const pText = document.getElementById('loading-text');
        pText.textContent = loadingTexts[0];

        const timer = setInterval(() => {
            idx = (idx + 1) % loadingTexts.length;
            pText.textContent = loadingTexts[idx];
        }, 1000);

        try {
            const response = await fetch('/api/analyze/face', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageBase64: state.imageData, question: state.question })
            });
            clearInterval(timer);

            if (!response.ok) throw new Error('推演失败，请重试');
            const result = await response.json();
            if (!result.success) throw new Error(result.error || '推演失败');

            renderResult(result.data);
            setTimeout(() => switchScreen('result'), 500);
        } catch (error) {
            clearInterval(timer);
            console.error(error);
            alert('推演失败：' + error.message + '\n\n请确保后端服务已启动（本地需 npm start）');
            switchScreen('input');
        }
    }

    function renderResult(data) {
        state.resultData = data;
        document.getElementById('r-title').textContent = data.title;
        document.getElementById('r-star').textContent = `主星：${data.star}`;
        document.getElementById('r-question').textContent = state.question;

        const stars = '★'.repeat(data.rarity) + '☆'.repeat(5 - data.rarity);
        document.getElementById('r-stars').textContent = stars;
        document.getElementById('r-percent').textContent = `命格稀有度 ${data.rarityPercent}%`;

        document.getElementById('r-conclusion').innerHTML = data.conclusion;

        document.getElementById('r-evidences').innerHTML = data.evidences.map(e => `
            <div class="evidence-card">
                <div class="evidence-loc">🎯 ${e.loc}</div>
                <div class="evidence-feat">${e.feat}</div>
                <div class="evidence-meaning">${e.meaning}</div>
            </div>
        `).join('');
    }

    function switchScreen(name) {
        Object.values(dom.screens).forEach(s => s.classList.remove('active'));
        dom.screens[name].classList.add('active');
    }

    async function handleShare() {
        if (!state.resultData) return;
        await ShareManager.triggerShare('face', state.resultData, state.question);
    }

    function handleUnlock() {
        alert('广告功能开发中\n\n观看15秒广告后将解锁完整批文');
    }

    function handleRestart() {
        state.imageUploaded = false;
        state.imageData = null;
        state.question = '';
        dom.previewImage.style.display = 'none';
        dom.uploadPlaceholder.style.display = 'flex';
        dom.btnAnalyze.disabled = true;
        dom.imageInput.value = '';
        dom.customQuestion.value = '';
        dom.qBtns.forEach(b => b.classList.remove('selected'));
        switchScreen('input');
    }
});
