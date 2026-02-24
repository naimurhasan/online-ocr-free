// ── settings.js ── Engine config, user preferences, advanced settings (depends on state.js)

const fetchServerConfig = async () => {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        serverMaxThreads = Math.max(1, data.maxConcurrentThreads || 4);
        serverDefaultPrompt = data.defaultPrompt || '';
        if (concurrentThreadsSlider) {
            concurrentThreadsSlider.max = serverMaxThreads;
        }
    } catch (err) {
        console.warn('Failed to fetch server config:', err);
    }
};

const isGoogleVisionSelected = () => ocrEngineSelect && ocrEngineSelect.value === 'google-vision';
const isOpenRouterSelected = () => ocrEngineSelect && (
    ocrEngineSelect.value === 'gemma-openrouter-free' ||
    ocrEngineSelect.value === 'gemma-openrouter-paid' ||
    ocrEngineSelect.value === 'mistral-openrouter-free' ||
    ocrEngineSelect.value === 'mistral-openrouter-paid' ||
    ocrEngineSelect.value === 'openrouter-custom'
);
const isOpenRouterCustomSelected = () => ocrEngineSelect && ocrEngineSelect.value === 'openrouter-custom';

const getGoogleVisionApiKey = () => (googleVisionApiKeyInput?.value || '').trim();
const getOpenRouterApiKey = () => (openRouterApiKeyInput?.value || '').trim();

const updateEngineUI = () => {
    if (!googleVisionKeyWrap || !openRouterKeyWrap || !openRouterFormatWrap) return;
    googleVisionKeyWrap.classList.toggle('hidden', !isGoogleVisionSelected());
    openRouterKeyWrap.classList.toggle('hidden', !isOpenRouterSelected());
    openRouterFormatWrap.classList.toggle('hidden', !isOpenRouterSelected());
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
        openRouterCustomModel: openRouterCustomModelInput?.value || ''
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
        defaultPromptDisplay.textContent = serverDefaultPrompt || '(Could not load default prompt from server)';
        defaultPromptDisplay.classList.add('hidden');
        toggleDefaultPromptBtn.classList.remove('expanded');
        toggleDefaultPromptBtn.innerHTML = '<i class="fas fa-chevron-right"></i> Show default prompt';
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
    localStorage.removeItem(OPENROUTER_KEY_STORAGE_KEY);
    localStorage.removeItem(OPENROUTER_KEY_CONSENT_KEY);

    languageSelect.value = 'eng';
    ocrEngineSelect.value = 'tesseract';
    if (openRouterOutputFormatSelect) openRouterOutputFormatSelect.value = 'plain';
    if (openRouterCustomModelInput) openRouterCustomModelInput.value = '';
    if (googleVisionApiKeyInput) googleVisionApiKeyInput.value = '';
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
