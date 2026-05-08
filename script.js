document.addEventListener('DOMContentLoaded', () => {

    // ----------------------------------------------------------------
    //  ตรวจสอบ browser รองรับ Speech Recognition ไหม
    // ----------------------------------------------------------------
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('เบราว์เซอร์ไม่รองรับ Web Speech API\nแนะนำให้ใช้ Google Chrome หรือ Edge ครับ');
        return;
    }

    // ----------------------------------------------------------------
    //  DOM Elements
    // ----------------------------------------------------------------
    const btnTheme       = document.getElementById('btn-theme');
    const btnMic         = document.getElementById('btn-mic');
    const btnObs         = document.getElementById('btn-obs');
    const btnSettings    = document.getElementById('btn-settings');
    const settingsPanel  = document.getElementById('settings-panel');
    const statusEl       = document.getElementById('status-indicator');
    const sourceLang     = document.getElementById('source-lang');
    const targetLang     = document.getElementById('target-lang');
    const apiKeyInput    = document.getElementById('api-key-input');
    const btnSaveKey     = document.getElementById('btn-save-key');
    const apiKeyStatus   = document.getElementById('api-key-status');
    const sourceText     = document.getElementById('source-text');
    const translatedText = document.getElementById('translated-text');

    // ----------------------------------------------------------------
    //  State
    // ----------------------------------------------------------------
    let isListening          = false;
    let isRecognitionRunning = false;
    let isLightMode          = false;
    let hideTimer            = null;
    let abortController      = null;

    // ----------------------------------------------------------------
    //  Load saved API Key จาก localStorage
    // ----------------------------------------------------------------
    const savedKey = localStorage.getItem('claude_api_key');
    if (savedKey) {
        apiKeyInput.value = savedKey;
        apiKeyStatus.textContent = '✓ Key saved';
    }

    // ----------------------------------------------------------------
    //  Save API Key
    // ----------------------------------------------------------------
    btnSaveKey.addEventListener('click', () => {
        const key = apiKeyInput.value.trim();
        if (!key) {
            apiKeyStatus.style.color = 'var(--accent-red)';
            apiKeyStatus.textContent = '✗ กรุณากรอก Key';
            return;
        }
        localStorage.setItem('claude_api_key', key);
        apiKeyStatus.style.color = 'var(--accent)';
        apiKeyStatus.textContent = '✓ Saved!';
    });

    // ----------------------------------------------------------------
    //  Theme Toggle (Dark / Light)
    // ----------------------------------------------------------------
    btnTheme.addEventListener('click', () => {
        isLightMode = !isLightMode;
        document.body.classList.toggle('light-mode', isLightMode);
        btnTheme.innerHTML = isLightMode
            ? '<i class="fa-solid fa-moon"></i>'
            : '<i class="fa-solid fa-sun"></i>';
    });

    // ----------------------------------------------------------------
    //  Settings Panel (toggle + ปิดเมื่อคลิกข้างนอก)
    // ----------------------------------------------------------------
    btnSettings.addEventListener('click', (e) => {
        e.stopPropagation();
        settingsPanel.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && e.target !== btnSettings) {
            settingsPanel.classList.add('hidden');
        }
    });

    // ----------------------------------------------------------------
    //  OBS Mode (พื้นหลังเขียว)
    // ----------------------------------------------------------------
    btnObs.addEventListener('click', () => {
        document.body.classList.toggle('obs-mode');
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') document.body.classList.remove('obs-mode');
    });

    // ----------------------------------------------------------------
    //  Speech Recognition Setup
    // ----------------------------------------------------------------
    const recognition        = new SpeechRecognition();
    recognition.continuous   = true;
    recognition.interimResults = true;

    function startRecognition() {
        if (isRecognitionRunning) return;
        recognition.lang = sourceLang.value;
        try {
            recognition.start();
            isRecognitionRunning = true;
        } catch (e) {
            isRecognitionRunning = false;
        }
    }

    function stopRecognition() {
        isListening          = false;
        isRecognitionRunning = false;
        recognition.stop();
    }

    // ----------------------------------------------------------------
    //  Mic Button
    // ----------------------------------------------------------------
    btnMic.addEventListener('click', () => {
        if (isListening) {
            stopRecognition();
            btnMic.classList.remove('active');
            btnMic.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            setStatus('READY', 'var(--accent)');
        } else {
            isListening = true;
            startRecognition();
            btnMic.classList.add('active');
            btnMic.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            setStatus('LISTENING...', 'var(--accent-red)');
        }
    });

    function setStatus(text, color) {
        statusEl.textContent = text;
        statusEl.parentElement.style.color = color;
    }

    // ----------------------------------------------------------------
    //  Recognition Events
    // ----------------------------------------------------------------
    recognition.onstart = () => { isRecognitionRunning = true; };

    recognition.onend = () => {
        isRecognitionRunning = false;
        // restart อัตโนมัติถ้ายัง listening อยู่
        if (isListening) setTimeout(startRecognition, 300);
    };

    recognition.onerror = (e) => {
        isRecognitionRunning = false;
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        setStatus('ERR: ' + e.error.toUpperCase(), 'var(--accent-red)');
    };

    recognition.onresult = async (event) => {
        let interim = '';
        let final   = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            event.results[i].isFinal ? (final += t) : (interim += t);
        }

        const current = final || interim;
        const isFinal = event.results[event.results.length - 1].isFinal;

        if (!current.trim()) return;

        // แสดงข้อความต้นฉบับเสมอ
        showText(sourceText, current);

        if (isFinal && final.trim()) {
            // ยกเลิก request เก่าที่ค้างอยู่
            if (abortController) abortController.abort();
            clearTimeout(hideTimer);

            showText(translatedText, '…');

            const result = await translateWithClaude(final);
            if (result !== null) {
                showText(translatedText, result);
                // ซ่อนซับไตเติลหลัง 6 วินาที
                hideTimer = setTimeout(hideAll, 6000);
            }

        } else if (!isFinal) {
            // ยังพูดไม่จบ — ซ่อนคำแปลเก่าก่อน
            hideText(translatedText);
        }
    };

    // ----------------------------------------------------------------
    //  Helper: show / hide text
    // ----------------------------------------------------------------
    function showText(el, text) {
        el.textContent = text;
        el.classList.add('show');
    }

    function hideText(el) {
        el.classList.remove('show');
    }

    function hideAll() {
        hideText(sourceText);
        hideText(translatedText);
    }

    // ----------------------------------------------------------------
    //  Claude API Translation
    // ----------------------------------------------------------------
    const LANG_NAMES = { th: 'Thai', en: 'English', zh: 'Chinese (Simplified)' };

    async function translateWithClaude(text) {
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

});
