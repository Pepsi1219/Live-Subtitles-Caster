/**
 * Live Subtitles App - Core Logic
 * ใช้ Web Speech API สำหรับถอดเสียง และ MyMemory API สำหรับแปลภาษา
 */

// ตรวจสอบการรองรับ Speech Recognition ของเบราว์เซอร์
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
    alert("เบราว์เซอร์ของคุณไม่รองรับ Web Speech API (แนะนำให้ใช้ Google Chrome หรือ Microsoft Edge เวอร์ชันล่าสุด)");
}

// --- ตัวแปรจัดการ State ---
let recognition = new SpeechRecognition();
let isListening = false;
let timeoutId = null;

// --- DOM Elements ---
const btnToggleMic = document.getElementById('toggle-mic-btn');
const btnText = document.getElementById('btn-text');
const btnObsMode = document.getElementById('obs-mode-btn');
const sourceLangSelect = document.getElementById('source-lang');
const targetLangSelect = document.getElementById('target-lang');
const sourceTextDisplay = document.getElementById('source-text');
const translatedTextDisplay = document.getElementById('translated-text');

// --- การตั้งค่า Speech Recognition ---
recognition.continuous = true; // ฟังต่อเนื่องไม่ตัดดับ
recognition.interimResults = true; // ให้ดึงคำที่กำลังพูดมาโชว์ระหว่างประโยคได้ (เพื่อความเรียลไทม์)

// เมื่อมีการเริ่มฟังเสียง
recognition.onstart = () => {
    isListening = true;
    btnToggleMic.classList.replace('bg-emerald-600', 'bg-rose-600');
    btnToggleMic.classList.replace('hover:bg-emerald-500', 'hover:bg-rose-500');
    btnText.innerText = "กำลังฟัง...";
    btnToggleMic.innerHTML = `<i class="fa-solid fa-stop"></i> <span id="btn-text">หยุดฟังเสียง</span>`;
    
    updateDisplay("กำลังฟัง...", "Listening...");
};

// เมื่อมีข้อความเสียงเข้ามา
recognition.onresult = async (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
        } else {
            interimTranscript += event.results[i][0].transcript;
        }
    }

    const textToShow = finalTranscript || interimTranscript;

    if (textToShow.trim() !== '') {
        // แสดงภาษาต้นฉบับบนจอทันที
        sourceTextDisplay.innerText = textToShow;
        sourceTextDisplay.classList.add('show');
        translatedTextDisplay.classList.add('show');

        // หากเป็นข้อความชั่วคราว (interim) ให้ขึ้น ... รอไว้ก่อนเพื่อไม่ให้ API ทำงานหนัก
        if (!finalTranscript) {
            translatedTextDisplay.innerText = "...";
        } 
        // หากพูดจบประโยค (final) ให้ส่งไปแปลภาษา
        else {
            translatedTextDisplay.innerText = "Translating...";
            const translatedText = await translateText(finalTranscript);
            translatedTextDisplay.innerText = translatedText;

            // หน่วงเวลาให้ซับหายไปเองถ้าไม่ได้พูดต่อภายใน 8 วินาที
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                sourceTextDisplay.classList.remove('show');
                translatedTextDisplay.classList.remove('show');
            }, 8000);
        }
    }
};

// เมื่อระบบหยุดฟังเอง (ป้องกันหลุด)
recognition.onend = () => {
    if (isListening) {
        // ถ้าเรายังเปิดไมค์อยู่ แต่ระบบตัด ให้เริ่มใหม่ทันที (Auto-restart)
        recognition.start();
    } else {
        btnToggleMic.classList.replace('bg-rose-600', 'bg-emerald-600');
        btnToggleMic.classList.replace('hover:bg-rose-500', 'hover:bg-emerald-500');
        btnToggleMic.innerHTML = `<i class="fa-solid fa-microphone"></i> <span id="btn-text">เริ่มฟังเสียง</span>`;
    }
};

// --- ฟังก์ชันแปลภาษาผ่าน API (ใช้ MyMemory API สำหรับเดโม่ฟรี) ---
async function translateText(text) {
    const sourceLang = sourceLangSelect.value.split('-')[0]; // แปลง th-TH เป็น th
    const targetLang = targetLangSelect.value;
    
    // หมายเหตุ: สำหรับโปรดักชันที่ใช้งานจริงจัง แนะนำให้เปลี่ยน URL นี้เป็น Google Cloud Translation API หรือ API หลังบ้านของคุณ
    const apiUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${sourceLang}|${targetLang}`;

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data.responseData.translatedText;
    } catch (error) {
        console.error("Translation Error:", error);
        return text; // ถ้าแปลไม่ได้ ให้โชว์ภาษาเดิม
    }
}

// --- Event Listeners สำหรับปุ่มต่างๆ ---

// ปุ่มเริ่ม/หยุดไมค์
btnToggleMic.addEventListener('click', () => {
    if (isListening) {
        isListening = false;
        recognition.stop();
    } else {
        recognition.lang = sourceLangSelect.value; // เซ็ตภาษาก่อนเริ่มฟัง
        recognition.start();
    }
});

// เปลี่ยนภาษาพูดระหว่างทาง
sourceLangSelect.addEventListener('change', () => {
    if (isListening) {
        recognition.stop(); // สั่งหยุดเพื่อให้มัน onend แล้ว restart ด้วยภาษาใหม่
    }
});

// ปุ่ม OBS Mode (สลับหน้าจอเป็น Green Screen)
btnObsMode.addEventListener('click', () => {
    document.body.classList.add('obs-mode');
    alert("เข้าสู่โหมด OBS (Green Screen) แล้ว!\n\nคุณสามารถนำหน้าต่างนี้ไปวางในแอปแชร์จอ (เช่น OBS) แล้วใช้ฟิลเตอร์ Chroma Key ดูดสีเขียวออกได้เลย\n\n**หากต้องการกลับสู่หน้าปกติ ให้กดปุ่ม ESC บนคีย์บอร์ด**");
});

// กด ESC เพื่อออกจากโหมด OBS
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('obs-mode')) {
        document.body.classList.remove('obs-mode');
    }
});
