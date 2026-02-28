// ── settings.js ── Engine config, user preferences, advanced settings (depends on state.js)

const fetchServerConfig = async () => {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        serverMaxThreads = Math.max(1, data.maxConcurrentThreads || 4);
        serverDefaultPromptPlain = data.defaultPromptPlain || '';
        serverDefaultPromptMarkdown = data.defaultPromptMarkdown || '';
        if (concurrentThreadsSlider) {
            concurrentThreadsSlider.max = serverMaxThreads;
        }
    } catch (err) {
        console.warn('Failed to fetch server config:', err);
    }
};

const isGoogleVisionSelected = () => ocrEngineSelect && ocrEngineSelect.value === 'google-vision';
const isGeminiSelected = () => ocrEngineSelect && (ocrEngineSelect.value === 'gemini-flash' || ocrEngineSelect.value === 'gemini-custom');
const isGeminiCustomSelected = () => ocrEngineSelect && ocrEngineSelect.value === 'gemini-custom';
const isOpenRouterSelected = () => ocrEngineSelect && (
    ocrEngineSelect.value === 'mistral-openrouter' ||
    ocrEngineSelect.value === 'gemma-openrouter' ||
    ocrEngineSelect.value === 'gemini3-flash-openrouter' ||
    ocrEngineSelect.value === 'nemotron-openrouter' ||
    ocrEngineSelect.value === 'openrouter-custom'
);
const isOpenRouterCustomSelected = () => ocrEngineSelect && ocrEngineSelect.value === 'openrouter-custom';

const getGoogleVisionApiKey = () => (googleVisionApiKeyInput?.value || '').trim();
const getGeminiApiKey = () => (geminiApiKeyInput?.value || '').trim();
const getOpenRouterApiKey = () => (openRouterApiKeyInput?.value || '').trim();

const updateEngineUI = () => {
    if (!googleVisionKeyWrap || !openRouterKeyWrap || !openRouterFormatWrap) return;
    googleVisionKeyWrap.classList.toggle('hidden', !isGoogleVisionSelected());
    if (geminiKeyWrap) geminiKeyWrap.classList.toggle('hidden', !isGeminiSelected());
    if (geminiCustomModelWrap) geminiCustomModelWrap.classList.toggle('hidden', !isGeminiCustomSelected());
    openRouterKeyWrap.classList.toggle('hidden', !isOpenRouterSelected());
    openRouterFormatWrap.classList.toggle('hidden', !isOpenRouterSelected() && !isGeminiSelected());
    if (openRouterCustomModelWrap) {
        openRouterCustomModelWrap.classList.toggle('hidden', !isOpenRouterCustomSelected());
    }
};

const appendOcrConfigToFormData = (formData) => {
    formData.append('lang', languageSelect.value);
    formData.append('engine', ocrEngineSelect.value);
    if (isGoogleVisionSelected()) {
        formData.append('googleApiKey', getGoogleVisionApiKey());
    }
    if (isGeminiSelected()) {
        formData.append('geminiApiKey', getGeminiApiKey());
        formData.append('openRouterOutputFormat', openRouterOutputFormatSelect?.value || 'plain');
        if (isGeminiCustomSelected() && geminiCustomModelInput) {
            formData.append('geminiCustomModel', geminiCustomModelInput.value.trim());
        }
        if (advancedSettings.customPrompt) {
            formData.append('customPrompt', advancedSettings.customPrompt);
        }
    }
    if (isOpenRouterSelected()) {
        formData.append('openRouterApiKey', getOpenRouterApiKey());
        formData.append('openRouterOutputFormat', openRouterOutputFormatSelect?.value || 'plain');
        if (isOpenRouterCustomSelected() && openRouterCustomModelInput) {
            formData.append('openRouterCustomModel', openRouterCustomModelInput.value.trim());
        }
        if (advancedSettings.customPrompt) {
            formData.append('customPrompt', advancedSettings.customPrompt);
        }
    }
    if (advancedSettings.skipPreprocessing) {
        formData.append('skipPreprocessing', 'true');
    }
};

const saveUserPreferences = () => {
    const prefs = {
        language: languageSelect.value,
        engine: ocrEngineSelect.value,
        openRouterOutputFormat: openRouterOutputFormatSelect?.value || 'plain',
        openRouterCustomModel: openRouterCustomModelInput?.value || '',
        geminiCustomModel: geminiCustomModelInput?.value || ''
    };
    localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(prefs));
};

const saveAdvancedSettingsToStorage = () => {
    localStorage.setItem(ADVANCED_SETTINGS_KEY, JSON.stringify(advancedSettings));
};

const loadAdvancedSettingsFromStorage = () => {
    try {
        const raw = localStorage.getItem(ADVANCED_SETTINGS_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            advancedSettings.concurrentThreads = Math.min(Math.max(1, parsed.concurrentThreads || 1), serverMaxThreads);
            advancedSettings.customPrompt = parsed.customPrompt || '';
            advancedSettings.skipPreprocessing = !!parsed.skipPreprocessing;
        }
    } catch (err) {
        console.warn('Failed to load advanced settings:', err);
    }
};

const openAdvancedSettings = () => {
    if (concurrentThreadsSlider) {
        concurrentThreadsSlider.max = serverMaxThreads;
        concurrentThreadsSlider.value = advancedSettings.concurrentThreads;
        concurrentThreadsValue.textContent = advancedSettings.concurrentThreads;
    }
    if (preprocessingToggle) {
        preprocessingToggle.checked = !advancedSettings.skipPreprocessing;
    }
    if (customPromptInput) {
        customPromptInput.value = advancedSettings.customPrompt;
    }
    if (defaultPromptDisplay) {
        const isMarkdown = openRouterOutputFormatSelect?.value === 'markdown';
        const activePrompt = isMarkdown ? serverDefaultPromptMarkdown : serverDefaultPromptPlain;
        const formatLabel = isMarkdown ? 'markdown' : 'plain text';
        defaultPromptDisplay.textContent = activePrompt || '(Could not load default prompt from server)';
        defaultPromptDisplay.classList.add('hidden');
        toggleDefaultPromptBtn.classList.remove('expanded');
        toggleDefaultPromptBtn.innerHTML = `<i class="fas fa-chevron-right"></i> Show default prompt (${formatLabel})`;
    }
    advancedSettingsModal.classList.remove('hidden');
};

const closeAdvancedSettings = () => {
    advancedSettingsModal.classList.add('hidden');
};

const saveAdvancedSettings = () => {
    advancedSettings.concurrentThreads = Math.min(
        Math.max(1, parseInt(concurrentThreadsSlider?.value || '1', 10)),
        serverMaxThreads
    );
    advancedSettings.customPrompt = (customPromptInput?.value || '').trim();
    advancedSettings.skipPreprocessing = !(preprocessingToggle?.checked ?? true);
    saveAdvancedSettingsToStorage();
    closeAdvancedSettings();
    showToast('Settings saved');
};

const TRANSLATION_PROMPT_TEMPLATE = `You are an advanced OCR engine. Extract all readable text from this image.
After completing the extraction and layout reconstruction, **translate the entire content into {{LANG}}**, strictly preserving the exact same visual and structural format.

Return valid Markdown and HTML that strictly preserves the visual and structural layout of the document.

---

### Rules for Structure Preservation:

* **Layout Detection (CRITICAL):**

  * If the image has a **multi-column layout**, you MUST use an HTML \`<table>\` with \`style="border: none; border-collapse: collapse; width: 100%;"\` to represent text side-by-side.
  * Ensure all \`<td>\` and \`<tr>\` tags include \`style="border: none; vertical-align: top;"\` to ensure no borders are rendered and text aligns to the top.
  * If the image is a **single-column layout**, use standard paragraphs and headings.

* **Hierarchy:** Use appropriate Markdown headers (#, ##, ###) or bold text to match visual importance.

* **Mathematical Expressions:** You **must** use $...$ for inline math and $$...$$ for block math.

* **Formatting:** Use **bold** for visually bold text and *italics* for italicized text.

* **Lists:** Use Markdown syntax for bullets or numbered lists.

* **Accuracy:** First transcribe text exactly as written. Then translate all textual content into {{LANG}} while keeping the same structure, formatting, table layout, line breaks, emphasis, and mathematical notation.

---

### Output Constraints:

* Do not add commentary or summaries.
* Do not include the original language in the final output.
* Return only the {{LANG}}-translated Markdown/HTML content.
* Use HTML tables for multi-column layouts to ensure a borderless appearance.`;

const handleUseTranslationPrompt = () => {
    const lang = prompt('Enter the target language for translation (e.g. Bangla, Hindi, Spanish):');
    if (!lang || !lang.trim()) return;
    const filled = TRANSLATION_PROMPT_TEMPLATE.replace(/\{\{LANG\}\}/g, lang.trim());
    if (customPromptInput) {
        customPromptInput.value = filled;
        customPromptInput.focus();
    }
    showToast('Translation prompt set. Make sure to use an AI engine (Gemini or OpenRouter) — Tesseract and Google Vision ignore custom prompts.', 5000);
};

const resetAllSettings = async () => {
    const confirmed = await showAppConfirm(
        'This will reset all settings (language, engine, API keys, advanced settings) to their defaults. Continue?',
        { title: 'Reset All Settings', confirmText: 'Reset', danger: true }
    );
    if (!confirmed) return;

    localStorage.removeItem(PREFS_STORAGE_KEY);
    localStorage.removeItem(ADVANCED_SETTINGS_KEY);
    localStorage.removeItem(GOOGLE_KEY_STORAGE_KEY);
    localStorage.removeItem(GOOGLE_KEY_CONSENT_KEY);
    localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    localStorage.removeItem(GEMINI_KEY_CONSENT_KEY);
    localStorage.removeItem(OPENROUTER_KEY_STORAGE_KEY);
    localStorage.removeItem(OPENROUTER_KEY_CONSENT_KEY);
    localStorage.removeItem('onlineocrfree_onboarding_done_v1');

    languageSelect.value = 'eng';
    ocrEngineSelect.value = 'tesseract';
    if (openRouterOutputFormatSelect) openRouterOutputFormatSelect.value = 'plain';
    if (openRouterCustomModelInput) openRouterCustomModelInput.value = '';
    if (geminiCustomModelInput) geminiCustomModelInput.value = '';
    if (googleVisionApiKeyInput) googleVisionApiKeyInput.value = '';
    if (geminiApiKeyInput) geminiApiKeyInput.value = '';
    if (openRouterApiKeyInput) openRouterApiKeyInput.value = '';

    advancedSettings = { concurrentThreads: 1, customPrompt: '', skipPreprocessing: false };

    if (concurrentThreadsSlider) {
        concurrentThreadsSlider.value = 1;
        concurrentThreadsValue.textContent = '1';
    }
    if (preprocessingToggle) preprocessingToggle.checked = true;
    if (customPromptInput) customPromptInput.value = '';

    updateEngineUI();
    updateGlobalButtons();
    closeAdvancedSettings();
    showToast('All settings reset to defaults');
};

const encodeForStorage = (plainText) => {
    return btoa(unescape(encodeURIComponent(plainText)));
};

const decodeFromStorage = (payload) => {
    if (!payload) return '';
    return decodeURIComponent(escape(atob(payload)));
};

const getGoogleStorageConsent = () => localStorage.getItem(GOOGLE_KEY_CONSENT_KEY);
const getGeminiStorageConsent = () => localStorage.getItem(GEMINI_KEY_CONSENT_KEY);
const getOpenRouterStorageConsent = () => localStorage.getItem(OPENROUTER_KEY_CONSENT_KEY);

const ensureGoogleKeyStorageConsent = async () => {
    const consent = getGoogleStorageConsent();
    if (consent === 'accepted') return true;

    const accepted = await showAppConfirm(
        'Allow this app to use browser cookies/local storage to save your encrypted Google Vision API key on this device?',
        { title: 'Storage Permission', confirmText: 'Allow' }
    );
    if (accepted) {
        localStorage.setItem(GOOGLE_KEY_CONSENT_KEY, 'accepted');
    } else {
        localStorage.removeItem(GOOGLE_KEY_CONSENT_KEY);
    }
    if (!accepted) {
        localStorage.removeItem(GOOGLE_KEY_STORAGE_KEY);
    }
    return accepted;
};

const ensureGeminiKeyStorageConsent = async () => {
    const consent = getGeminiStorageConsent();
    if (consent === 'accepted') return true;

    const accepted = await showAppConfirm(
        'Allow this app to use browser cookies/local storage to save your encrypted Gemini API key on this device?',
        { title: 'Storage Permission', confirmText: 'Allow' }
    );
    if (accepted) {
        localStorage.setItem(GEMINI_KEY_CONSENT_KEY, 'accepted');
    } else {
        localStorage.removeItem(GEMINI_KEY_CONSENT_KEY);
    }
    if (!accepted) {
        localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
    }
    return accepted;
};

const ensureOpenRouterKeyStorageConsent = async () => {
    const consent = getOpenRouterStorageConsent();
    if (consent === 'accepted') return true;

    const accepted = await showAppConfirm(
        'Allow this app to use browser cookies/local storage to save your encrypted OpenRouter API key on this device?',
        { title: 'Storage Permission', confirmText: 'Allow' }
    );
    if (accepted) {
        localStorage.setItem(OPENROUTER_KEY_CONSENT_KEY, 'accepted');
    } else {
        localStorage.removeItem(OPENROUTER_KEY_CONSENT_KEY);
    }
    if (!accepted) {
        localStorage.removeItem(OPENROUTER_KEY_STORAGE_KEY);
    }
    return accepted;
};

const persistGoogleKeyIfAllowed = async () => {
    if (!googleVisionApiKeyInput) return;
    const keyValue = getGoogleVisionApiKey();

    if (!keyValue) {
        localStorage.removeItem(GOOGLE_KEY_STORAGE_KEY);
        return;
    }

    if (!isGoogleVisionSelected()) return;
    const allowed = await ensureGoogleKeyStorageConsent();
    if (!allowed) return;

    try {
        const encrypted = encodeForStorage(keyValue);
        localStorage.setItem(GOOGLE_KEY_STORAGE_KEY, encrypted);
    } catch (err) {
        console.error('Failed to store Google key:', err);
    }
};

const persistGeminiKeyIfAllowed = async () => {
    if (!geminiApiKeyInput) return;
    const keyValue = getGeminiApiKey();

    if (!keyValue) {
        localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
        return;
    }

    if (!isGeminiSelected()) return;
    const allowed = await ensureGeminiKeyStorageConsent();
    if (!allowed) return;

    try {
        const encrypted = encodeForStorage(keyValue);
        localStorage.setItem(GEMINI_KEY_STORAGE_KEY, encrypted);
    } catch (err) {
        console.error('Failed to store Gemini key:', err);
    }
};

const persistOpenRouterKeyIfAllowed = async () => {
    if (!openRouterApiKeyInput) return;
    const keyValue = getOpenRouterApiKey();

    if (!keyValue) {
        localStorage.removeItem(OPENROUTER_KEY_STORAGE_KEY);
        return;
    }

    if (!isOpenRouterSelected()) return;
    const allowed = await ensureOpenRouterKeyStorageConsent();
    if (!allowed) return;

    try {
        const encrypted = encodeForStorage(keyValue);
        localStorage.setItem(OPENROUTER_KEY_STORAGE_KEY, encrypted);
    } catch (err) {
        console.error('Failed to store OpenRouter key:', err);
    }
};

const loadUserPreferences = async () => {
    try {
        const prefsRaw = localStorage.getItem(PREFS_STORAGE_KEY);
        if (prefsRaw) {
            const prefs = JSON.parse(prefsRaw);
            if (prefs.language) languageSelect.value = prefs.language;
            if (prefs.engine) ocrEngineSelect.value = prefs.engine;
            if (prefs.openRouterOutputFormat && openRouterOutputFormatSelect) openRouterOutputFormatSelect.value = prefs.openRouterOutputFormat;
            if (prefs.openRouterCustomModel && openRouterCustomModelInput) openRouterCustomModelInput.value = prefs.openRouterCustomModel;
            if (prefs.geminiCustomModel && geminiCustomModelInput) geminiCustomModelInput.value = prefs.geminiCustomModel;
        }
    } catch (err) {
        console.warn('Failed to load preferences:', err);
    }

    loadAdvancedSettingsFromStorage();

    if (getGoogleStorageConsent() === 'accepted') {
        try {
            const encrypted = localStorage.getItem(GOOGLE_KEY_STORAGE_KEY);
            if (encrypted) {
                const decrypted = decodeFromStorage(encrypted);
                if (decrypted) googleVisionApiKeyInput.value = decrypted;
            }
        } catch (err) {
            console.warn('Failed to decode stored Google key:', err);
            localStorage.removeItem(GOOGLE_KEY_STORAGE_KEY);
        }
    }

    if (getGeminiStorageConsent() === 'accepted') {
        try {
            const encrypted = localStorage.getItem(GEMINI_KEY_STORAGE_KEY);
            if (encrypted) {
                const decrypted = decodeFromStorage(encrypted);
                if (decrypted && geminiApiKeyInput) geminiApiKeyInput.value = decrypted;
            }
        } catch (err) {
            console.warn('Failed to decode stored Gemini key:', err);
            localStorage.removeItem(GEMINI_KEY_STORAGE_KEY);
        }
    }

    if (getOpenRouterStorageConsent() === 'accepted') {
        try {
            const encrypted = localStorage.getItem(OPENROUTER_KEY_STORAGE_KEY);
            if (encrypted) {
                const decrypted = decodeFromStorage(encrypted);
                if (decrypted) openRouterApiKeyInput.value = decrypted;
            }
        } catch (err) {
            console.warn('Failed to decode stored OpenRouter key:', err);
            localStorage.removeItem(OPENROUTER_KEY_STORAGE_KEY);
        }
    }
};
