document.addEventListener('DOMContentLoaded', () => {

    // --- 1. จัดการ Speech & Elements ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('เบราว์เซอร์ไม่รองรับ Web Speech API');
        return;
    }

    const pageSetup      = document.getElementById('page-setup');
    const pageApp        = document.getElementById('page-app');
    const statusEl       = document.getElementById('status-indicator');
    const sourceLang     = document.getElementById('source-lang');
    const targetLang     = document.getElementById('target-lang');
    const apiKeyInput    = document.getElementById('api-key-input');
    const apiKeyStatus   = document.getElementById('api-key-status');
    const sourceText     = document.getElementById('source-text');
    const translatedText = document.getElementById('translated-text');

    let isListening = false;
    let isRecognitionRunning = false;
    let isLightMode = false;
    let hideTimer = null;
    let abortController = null;

    // --- 2. ระบบ Drag & Drop (แก้ไขใหม่ให้รองรับทั้งเมาส์และมือถือ) ---
    function makeDraggable(element) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

        // รองรับทั้งเมาส์และนิ้วสัมผัส
        element.onmousedown = dragStart;
        element.ontouchstart = dragStart;

        function dragStart(e) {
            // ถ้าคลิกโดนปุ่ม หรือ select ไม่ต้องลาก
            if (e.target.closest('button') || e.target.closest('select') || e.target.closest('input')) return;

            // ตรวจสอบว่าเป็น Event ของเมาส์หรือนิ้ว
            const clientX = e.type === 'touchstart' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchstart' ? e.touches[0].clientY : e.clientY;

            pos3 = clientX;
            pos4 = clientY;

            if (e.type === 'mousedown') {
                document.onmouseup = dragEnd;
                document.onmousemove = dragMove;
            } else {
                document.ontouchend = dragEnd;
                document.ontouchmove = dragMove;
            }
        }

        function dragMove(e) {
            const clientX = e.type === 'touchmove' ? e.touches[0].clientX : e.clientX;
            const clientY = e.type === 'touchmove' ? e.touches[0].clientY : e.clientY;

            pos1 = pos3 - clientX;
            pos2 = pos4 - clientY;
            pos3 = clientX;
            pos4 = clientY;

            // ปรับตำแหน่งใหม่
            element.style.top = (element.offsetTop - pos2) + "px";
            element.style.left = (element.offsetLeft - pos1) + "px";
        }

        function dragEnd() {
            document.onmouseup = null;
            document.onmousemove = null;
            document.ontouchend = null;
            document.ontouchmove = null;
        }
    }

    // --- 3. สั่งให้กล่องเริ่มลากได้ (ต้องอยู่ใน DOMContentLoaded) ---
    const sourceBox = document.getElementById('source-container');
    const translatedBox = document.getElementById('translated-container');

    if (sourceBox) makeDraggable(sourceBox);
    if (translatedBox) makeDraggable(translatedBox);

    // --- 4. ปุ่มสลับหน้า และ Event อื่นๆ ---
    const btnEnterApp = document.getElementById('btn-enter-app');
    if (btnEnterApp) {
        btnEnterApp.addEventListener('click', () => {
            pageSetup.classList.replace('active', 'hidden');
            pageApp.classList.replace('hidden', 'active');
        });
    }

    const btnSaveKey = document.getElementById('btn-save-key');
    if (btnSaveKey) {
        btnSaveKey.addEventListener('click', () => {
            const key = apiKeyInput.value.trim();
            localStorage.setItem('claude_api_key', key);
            apiKeyStatus.textContent = '✓ Saved!';
        });
    }

    // ปุ่ม Theme
    document.querySelectorAll('.btn-theme').forEach(btn => {
        btn.addEventListener('click', () => {
            isLightMode = !isLightMode;
            document.body.classList.toggle('light-mode', isLightMode);
        });
    });

    // ปุ่มไมค์
    const btnMic = document.getElementById('btn-mic');
    if (btnMic) {
        btnMic.addEventListener('click', () => {
            if (isListening) {
                stopRecognition();
                btnMic.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            } else {
                isListening = true;
                startRecognition();
                btnMic.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            }
        });
    }

    // --- 5. ระบบ Speech & Translation (คงเดิม) ---
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    function startRecognition() {
        if (isRecognitionRunning) return;
        recognition.lang = sourceLang ? sourceLang.value : 'th-TH';
        try { recognition.start(); isRecognitionRunning = true; } catch (e) { }
    }

    function stopRecognition() { isListening = false; recognition.stop(); }

    recognition.onresult = async (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            event.results[i].isFinal ? (final += t) : (interim += t);
        }
        if (sourceText) sourceText.textContent = final || interim;
        
        if (event.results[event.results.length - 1].isFinal && final.trim()) {
            const result = await translateWithMyMemory(final);
            if (translatedText) translatedText.textContent = result;
        }
    };

    async function translateWithMyMemory(text) {
        const email = localStorage.getItem('claude_api_key') || "";
        const s = sourceLang.value.split('-')[0];
        const t = targetLang.value.split('-')[0];
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${s}|${t}${email ? '&de='+email : ''}`;
        try {
            const res = await fetch(apiUrl);
            const data = await res.json();
            return data.responseData.translatedText;
        } catch (err) { return text; }
    }
});


// --- เรียกใช้งาน (ใส่ไว้ใน DOMContentLoaded) ---
// makeDraggable(document.getElementById('source-container'));
// makeDraggable(document.getElementById('translated-container'));
  
  // ----------------------------------------------------------------
    //  Claude API Translation
    // ----------------------------------------------------------------

    /* async function translateWithClaude(text) {
        const apiKey = localStorage.getItem('claude_api_key');
        if (!apiKey) {
            // ยังไม่ได้ใส่ Key — แสดงข้อความต้นฉบับแทน
            return text;
        }

        const from = LANG_NAMES[sourceLang.value.split('-')[0]] || sourceLang.value;
        const to   = LANG_NAMES[targetLang.value] || targetLang.value;

        abortController = new AbortController();

        try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01',
                    'anthropic-dangerous-direct-browser-access': 'true'
                },
                body: JSON.stringify({
                    model: 'claude-haiku-4-5-20251001',
                    max_tokens: 256,
                    system: `You are a real-time subtitle translator from ${from} to ${to}.
Return ONLY the translated text. No explanations. No quotes. Keep it short and natural.`,
                    messages: [{ role: 'user', content: text }]
                }),
                signal: abortController.signal
            });

            if (!res.ok) {
                console.error('API error:', res.status, await res.text());
                return text;
            }

            const data = await res.json();
            return data.content?.[0]?.text?.trim() ?? text;

        } catch (err) {
            if (err.name === 'AbortError') return null; // ถูก cancel โดยเจตนา
            console.error('Fetch error:', err);
            return text;
        } finally {
            abortController = null;
        }
    }

});*/


