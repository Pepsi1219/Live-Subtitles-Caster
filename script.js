document.addEventListener('DOMContentLoaded', () => {

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('เบราว์เซอร์ไม่รองรับ Web Speech API');
        return;
    }

    // ----------------------------------------------------------------
    //  ฟังก์ชันช่วยตรวจสอบ Element (ป้องกัน Error properties of null)
    // ----------------------------------------------------------------
    const safeAddEventListener = (id, event, callback) => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener(event, callback);
            return el;
        }
        return null;
    };

    // ----------------------------------------------------------------
    //  DOM Elements & State
    // ----------------------------------------------------------------
    const pageSetup      = document.getElementById('page-setup');
    const pageApp        = document.getElementById('page-app');
    const statusEl       = document.getElementById('status-indicator');
    const sourceLang     = document.getElementById('source-lang');
    const targetLang     = document.getElementById('target-lang');
    const apiKeyInput    = document.getElementById('api-key-input');
    const apiKeyStatus   = document.getElementById('api-key-status');
    const sourceText     = document.getElementById('source-text');
    const translatedText = document.getElementById('translated-text');

    let isListening          = false;
    let isRecognitionRunning = false;
    let isLightMode          = false;
    let hideTimer            = null;
    let abortController      = null;

    // ----------------------------------------------------------------
    //  จัดการปุ่มต่างๆ แบบปลอดภัย (Safe Handling)
    // ----------------------------------------------------------------

    // ปุ่มสลับหน้า (Setup -> App)
    safeAddEventListener('btn-enter-app', 'click', () => {
        if (pageSetup && pageApp) {
            pageSetup.classList.remove('active');
            pageSetup.classList.add('hidden');
            pageApp.classList.remove('hidden');
            pageApp.classList.add('active');
        }
    });

    // ปุ่ม Save Email
    safeAddEventListener('btn-save-key', 'click', () => {
        if (apiKeyInput && apiKeyStatus) {
            const key = apiKeyInput.value.trim();
            if (!key) {
                apiKeyStatus.style.color = 'var(--accent-red)';
                apiKeyStatus.textContent = '✗ กรุณากรอก Email';
                return;
            }
            localStorage.setItem('claude_api_key', key);
            apiKeyStatus.style.color = 'var(--accent)';
            apiKeyStatus.textContent = '✓ Saved!';
        }
    });

    // ปุ่ม Theme (รองรับทั้ง 2 หน้า)
    const themeButtons = document.querySelectorAll('.btn-theme');
    themeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            isLightMode = !isLightMode;
            document.body.classList.toggle('light-mode', isLightMode);
            const icon = isLightMode ? 'fa-moon' : 'fa-sun';
            themeButtons.forEach(b => {
                b.innerHTML = `<i class="fa-solid ${icon}"></i>`;
            });
        });
    });

    // ปุ่มไมค์
    const btnMic = safeAddEventListener('btn-mic', 'click', () => {
        if (isListening) {
            stopRecognition();
            if (btnMic) btnMic.innerHTML = '<i class="fa-solid fa-microphone-slash"></i>';
            setStatus('READY', 'var(--accent)');
        } else {
            isListening = true;
            startRecognition();
            if (btnMic) btnMic.innerHTML = '<i class="fa-solid fa-microphone"></i>';
            setStatus('LISTENING...', 'var(--accent-red)');
        }
    });

    // ----------------------------------------------------------------
    //  Speech Recognition Logic
    // ----------------------------------------------------------------
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    function startRecognition() {
        if (isRecognitionRunning) return;
        recognition.lang = sourceLang ? sourceLang.value : 'th-TH';
        try {
            recognition.start();
            isRecognitionRunning = true;
        } catch (e) { isRecognitionRunning = false; }
    }

    function stopRecognition() {
        isListening = false;
        isRecognitionRunning = false;
        recognition.stop();
    }

    function setStatus(text, color) {
        if (statusEl) {
            statusEl.textContent = text;
            statusEl.parentElement.style.color = color;
        }
    }

    // ----------------------------------------------------------------
    //  Recognition Events & Translation
    // ----------------------------------------------------------------
    recognition.onend = () => {
        isRecognitionRunning = false;
        if (isListening) setTimeout(startRecognition, 300);
    };

    recognition.onresult = async (event) => {
        let interim = '';
        let final = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const t = event.results[i][0].transcript;
            event.results[i].isFinal ? (final += t) : (interim += t);
        }
        const current = final || interim;
        if (!current.trim()) return;

        if (sourceText) {
            sourceText.textContent = current;
            sourceText.classList.add('show');
        }

        if (event.results[event.results.length - 1].isFinal && final.trim()) {
            if (abortController) abortController.abort();
            clearTimeout(hideTimer);

            if (translatedText) {
                translatedText.textContent = '…';
                translatedText.classList.add('show');
            }

            const result = await translateWithMyMemory(final);
            if (result && translatedText) {
                translatedText.textContent = result;
                hideTimer = setTimeout(() => {
                    if (sourceText) sourceText.classList.remove('show');
                    if (translatedText) translatedText.classList.remove('show');
                }, 6000);
            }
        }
    };

    async function translateWithMyMemory(text) {
        const email = localStorage.getItem('claude_api_key') || "";
        const s = sourceLang ? sourceLang.value.split('-')[0] : 'th';
        const t = targetLang ? targetLang.value.split('-')[0] : 'en';
        const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${s}|${t}${email ? '&de=' + email : ''}`;

        abortController = new AbortController();
        try {
            const res = await fetch(apiUrl, { signal: abortController.signal });
            const data = await res.json();
            return data.responseData.translatedText;
        } catch (err) { return text; }
    }

    // Load initial data
    const savedKey = localStorage.getItem('claude_api_key');
    if (savedKey && apiKeyInput) {
        apiKeyInput.value = savedKey;
        if (apiKeyStatus) apiKeyStatus.textContent = '✓ Email loaded';
    }
});

  
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


