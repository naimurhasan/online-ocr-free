// State Management
let filesData = []; // { id, file, name, status: 'pending'|'processing'|'done'|'error', text: '', previewUrl: '' }
let activeFileId = null;

// Zoom/Pan state
let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

// DOM Elements
const fileInput = document.getElementById('fileInput');
const selectColumnsBtn = document.getElementById('selectColumnsBtn');
const confirmSplitBtn = document.getElementById('confirmSplitBtn');
const columnsModal = document.getElementById('columnsModal');
const cancelColumnsBtn = document.getElementById('cancelColumnsBtn');
const columnOptions = document.querySelectorAll('.column-option');
const columnPdfPageControl = document.getElementById('columnPdfPageControl');
const columnPdfPageNum = document.getElementById('columnPdfPageNum');
const settingsModal = document.getElementById('settingsModal');
const settingsModalTitle = document.getElementById('settingsModalTitle');
const settingsFileName = document.getElementById('settingsFileName');
const pdfPageSettings = document.getElementById('pdfPageSettings');
const pdfPageHint = document.getElementById('pdfPageHint');
const startPageInput = document.getElementById('startPage');
const endPageInput = document.getElementById('endPage');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const rotationHand = document.getElementById('rotationHand');
const rotationPoints = document.querySelectorAll('.rotation-point');
const addFilesBtn = document.getElementById('addFilesBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const fileList = document.getElementById('fileList');
const previewContainer = document.getElementById('previewContainer');
const previewName = document.getElementById('previewName');
const outputText = document.getElementById('outputText');
const processBtn = document.getElementById('processBtn');
const copyBtn = document.getElementById('copyBtn');
const themeToggleBtn = document.getElementById('themeToggle');
const languageSelect = document.getElementById('language');
const languageWrap = document.getElementById('languageWrap');
const ocrEngineSelect = document.getElementById('ocrEngine');
const googleVisionKeyWrap = document.getElementById('googleVisionKeyWrap');
const googleVisionApiKeyInput = document.getElementById('googleVisionApiKey');
const openRouterKeyWrap = document.getElementById('openRouterKeyWrap');
const openRouterApiKeyInput = document.getElementById('openRouterApiKey');
const openRouterFormatWrap = document.getElementById('openRouterFormatWrap');
const openRouterOutputFormatSelect = document.getElementById('openRouterOutputFormat');
const openRouterCustomModelWrap = document.getElementById('openRouterCustomModelWrap');
const openRouterCustomModelInput = document.getElementById('openRouterCustomModel');
const fileCountSpan = document.getElementById('fileCount');
const reviewModal = document.getElementById('reviewModal');
const cancelReviewBtn = document.getElementById('cancelReviewBtn');
const confirmReviewBtn = document.getElementById('confirmReviewBtn');
const reviewLanguage = document.getElementById('reviewLanguage');
const reviewColumns = document.getElementById('reviewColumns');
const reviewSelectionCount = document.getElementById('reviewSelectionCount');
const reviewEngine = document.getElementById('reviewEngine');
const exportModal = document.getElementById('exportModal');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const exportCombinedBtn = document.getElementById('exportCombinedBtn');
const exportZipBtn = document.getElementById('exportZipBtn');
const appAlertModal = document.getElementById('appAlertModal');
const appAlertTitle = document.getElementById('appAlertTitle');
const appAlertMessage = document.getElementById('appAlertMessage');
const appAlertCancelBtn = document.getElementById('appAlertCancelBtn');
const appAlertConfirmBtn = document.getElementById('appAlertConfirmBtn');
const overallProgress = document.getElementById('overallProgress');
const overallProgressText = document.getElementById('overallProgressText');
const overallEtaText = document.getElementById('overallEtaText');
const overallProgressFill = document.getElementById('overallProgressFill');
const overallProgressCurrent = document.getElementById('overallProgressCurrent');

// --- Initialization ---
// Global Columns Configuration
let globalColumnsConfigs = {
    active: false,
    numColumns: 1,
    splitPositions: [] // percentages [0..1]
};

const cloneColumnsConfig = (config) => ({
    active: !!config?.active,
    numColumns: Math.max(1, parseInt(config?.numColumns || 1, 10)),
    splitPositions: Array.isArray(config?.splitPositions) ? [...config.splitPositions] : []
});

const getFileColumnsConfig = (file) => cloneColumnsConfig(file?.columnConfig || {
    active: false,
    numColumns: 1,
    splitPositions: []
});

const syncColumnsFromFile = (file) => {
    globalColumnsConfigs = getFileColumnsConfig(file);
};

const syncColumnsToFile = (file) => {
    if (!file) return;
    file.columnConfig = cloneColumnsConfig(globalColumnsConfigs);
};

const updateColumnsButtonUI = () => {
    if (globalColumnsConfigs.active && globalColumnsConfigs.numColumns > 1) {
        confirmSplitBtn.classList.add('hidden');
        confirmSplitBtn.classList.remove('btn-pulse');
        selectColumnsBtn.classList.remove('btn-secondary');
        selectColumnsBtn.classList.add('btn-primary');
        selectColumnsBtn.innerHTML = `<i class="fas fa-columns"></i> ${globalColumnsConfigs.numColumns} Cols`;
        return;
    }

    if (globalColumnsConfigs.numColumns > 1) {
        confirmSplitBtn.classList.remove('hidden');
        confirmSplitBtn.classList.add('btn-pulse');
        selectColumnsBtn.classList.remove('btn-primary');
        selectColumnsBtn.classList.add('btn-secondary');
        selectColumnsBtn.innerHTML = '<i class="fas fa-columns"></i> Columns';
        return;
    }

    confirmSplitBtn.classList.add('hidden');
    confirmSplitBtn.classList.remove('btn-pulse');
    selectColumnsBtn.classList.remove('btn-primary');
    selectColumnsBtn.classList.add('btn-secondary');
    selectColumnsBtn.innerHTML = '<i class="fas fa-columns"></i> Columns';
};

let batchProgress = {
    running: false,
    totalFiles: 0,
    completedFiles: 0,
    startedAt: 0,
    currentFileName: '',
    lastRunDurationMs: 0
};

let progressTimerId = null;
let appAlertResolver = null;

const PREFS_STORAGE_KEY = 'ocr_magic_prefs_v1';
const GOOGLE_KEY_STORAGE_KEY = 'ocr_magic_google_key_enc_v1';
const GOOGLE_KEY_CONSENT_KEY = 'ocr_magic_google_key_cookie_consent_v1';
const OPENROUTER_KEY_STORAGE_KEY = 'ocr_magic_openrouter_key_enc_v1';
const OPENROUTER_KEY_CONSENT_KEY = 'ocr_magic_openrouter_key_cookie_consent_v1';

const init = async () => {
    initTheme();
    setupEventListeners();
    await loadUserPreferences();
    updateEngineUI();
    updateOverallProgressUI();
    updateGlobalButtons();
};

const setupEventListeners = () => {
    // File adding
    if (addFilesBtn) {
        addFilesBtn.addEventListener('click', () => fileInput.click());
    }
    fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop
    fileList.addEventListener('click', (e) => {
        // If clicking the empty state (not the list container itself), open file dialog
        if (e.target.closest('.empty-state') && !batchProgress.running) {
            fileInput.click();
        }
    });

    fileList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy'; // Explicitly set drag cursor
        fileList.classList.add('drag-over');
    });

    fileList.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileList.classList.remove('drag-over');
    });

    fileList.addEventListener('drop', (e) => {
        e.preventDefault();
        if (batchProgress.running) return;
        fileList.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files; // Optional: sync input
            handleFileSelect({ target: { files: e.dataTransfer.files } });
        }
    });

    // Global Actions
    clearAllBtn.addEventListener('click', clearAll);
    downloadAllBtn.addEventListener('click', openExportModal);

    // Result Actions
    processBtn.addEventListener('click', handleProcessClick);
    copyBtn.addEventListener('click', copyToClipboard);
    cancelReviewBtn.addEventListener('click', closeReviewModal);
    confirmReviewBtn.addEventListener('click', startBatchProcessing);
    cancelExportBtn.addEventListener('click', closeExportModal);
    exportCombinedBtn.addEventListener('click', downloadCombinedTxt);
    exportZipBtn.addEventListener('click', downloadAllZip);
    appAlertCancelBtn.addEventListener('click', () => resolveAppAlert(false));
    appAlertConfirmBtn.addEventListener('click', () => resolveAppAlert(true));
    appAlertModal.addEventListener('click', (e) => {
        if (e.target === appAlertModal && !appAlertCancelBtn.classList.contains('hidden')) {
            resolveAppAlert(false);
        }
    });

    // Theme
    themeToggleBtn.addEventListener('click', toggleTheme);
    languageSelect.addEventListener('change', saveUserPreferences);
    ocrEngineSelect.addEventListener('change', async () => {
        if (isGoogleVisionSelected()) {
            await ensureGoogleKeyStorageConsent();
        }
        if (isOpenRouterSelected()) {
            await ensureOpenRouterKeyStorageConsent();
        }
        saveUserPreferences();
        updateEngineUI();
        updateGlobalButtons();
    });
    openRouterOutputFormatSelect.addEventListener('change', saveUserPreferences);
    googleVisionApiKeyInput.addEventListener('input', async () => {
        await persistGoogleKeyIfAllowed();
        updateGlobalButtons();
    });
    openRouterApiKeyInput.addEventListener('input', async () => {
        await persistOpenRouterKeyIfAllowed();
        updateGlobalButtons();
    });
    if (openRouterCustomModelInput) {
        openRouterCustomModelInput.addEventListener('input', () => {
            saveUserPreferences();
            updateGlobalButtons();
        });
    }

    // API Key visibility toggle
    document.querySelectorAll('.btn-toggle-visibility').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetId = btn.getAttribute('data-target');
            const targetInput = document.getElementById(targetId);
            const icon = btn.querySelector('i');
            if (targetInput) {
                if (targetInput.type === 'password') {
                    targetInput.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    targetInput.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
        });
    });

    // Pagination
    document.getElementById('prevPageBtn').addEventListener('click', () => navigatePage(-1));
    document.getElementById('nextPageBtn').addEventListener('click', () => navigatePage(1));

    // Settings Modal
    cancelSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    rotationPoints.forEach((point) => {
        point.addEventListener('click', () => {
            const rotation = parseInt(point.dataset.rotation, 10) || 0;
            setSettingsRotation(rotation);
        });
    });

    // Columns Logic
    selectColumnsBtn.addEventListener('click', () => {
        if (!activeFileId) return;
        columnsModal.classList.remove('hidden');
    });

    cancelColumnsBtn.addEventListener('click', () => {
        columnsModal.classList.add('hidden');
    });

    columnOptions.forEach(btn => {
        btn.addEventListener('click', async () => {
            const cols = parseInt(btn.dataset.cols, 10);

            // If it's an unprocessed PDF, we want to extract the specific active page the user is looking at
            const file = filesData.find(f => f.id === activeFileId);
            if (cols > 1 && file && file.type === 'pdf' && file.pages.length === 0) {
                const targetPage = file.activeViewerPage || 1;
                // Temporarily disable buttons to show it's extracting
                columnsModal.classList.add('opacity-50');
                columnsModal.style.pointerEvents = 'none';

                // Keep the old url so we can revoke it
                const oldUrl = file.previewUrl;
                await generatePdfThumbnail(file, targetPage);
                if (oldUrl && oldUrl !== 'https://placehold.co/50x70?text=PDF') {
                    URL.revokeObjectURL(oldUrl);
                }

                columnsModal.classList.remove('opacity-50');
                columnsModal.style.pointerEvents = 'auto';
            }

            setupColumns(cols);
            columnsModal.classList.add('hidden');
        });
    });

    confirmSplitBtn.addEventListener('click', async () => {
        // Lock in the global config
        globalColumnsConfigs.active = globalColumnsConfigs.numColumns > 1;
        const activeFile = filesData.find(f => f.id === activeFileId);
        syncColumnsToFile(activeFile);

        if (filesData.length > 1 && globalColumnsConfigs.numColumns > 1) {
            const applyToRest = await showAppConfirm(
                'Apply this column split to all uploaded files?\n\nChoose "Cancel" for this file only.',
                { title: 'Apply Column Split', confirmText: 'Apply to all', cancelText: 'This file only' }
            );
            if (applyToRest) {
                const configToCopy = cloneColumnsConfig(globalColumnsConfigs);
                filesData.forEach((f) => {
                    f.columnConfig = cloneColumnsConfig(configToCopy);
                });
            }
        }

        // Remove draggable class from splitters to lock them
        const splitters = document.querySelectorAll('.column-splitter');
        splitters.forEach(s => s.style.pointerEvents = 'none');

        updateColumnsButtonUI();
        updateGlobalButtons(); // Un-disable Process Button state
        recenterPreviewView(); // Enforce the transition back to centered scrollable view
    });

    // Zoom/Pan on preview container
    previewContainer.addEventListener('wheel', handleZoomWheel, { passive: false });
    previewContainer.addEventListener('mousedown', handlePanStart);
    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanEnd);
};

// --- Theme Logic ---
const initTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
        document.body.classList.add('dark-mode');
        updateThemeIcon(true);
    }
};

const toggleTheme = () => {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    updateThemeIcon(isDark);
};

const updateThemeIcon = (isDark) => {
    const icon = themeToggleBtn.querySelector('i');
    icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
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

const getGoogleStorageConsent = () => localStorage.getItem(GOOGLE_KEY_CONSENT_KEY);
const getOpenRouterStorageConsent = () => localStorage.getItem(OPENROUTER_KEY_CONSENT_KEY);

const resolveAppAlert = (result) => {
    if (appAlertResolver) {
        appAlertResolver(result);
        appAlertResolver = null;
    }
    appAlertModal.classList.add('hidden');
};

const showAppAlert = async (message, options = {}) => {
    const {
        title = 'Notice',
        confirmText = 'OK',
        danger = false
    } = options;

    appAlertTitle.textContent = title;
    appAlertMessage.textContent = message;
    appAlertCancelBtn.classList.add('hidden');
    appAlertConfirmBtn.textContent = confirmText;
    appAlertConfirmBtn.classList.toggle('app-alert-danger', danger);
    appAlertModal.classList.remove('hidden');

    return new Promise((resolve) => {
        appAlertResolver = resolve;
    });
};

const showAppConfirm = async (message, options = {}) => {
    const {
        title = 'Confirm',
        confirmText = 'Confirm',
        cancelText = 'Cancel',
        danger = false
    } = options;

    appAlertTitle.textContent = title;
    appAlertMessage.textContent = message;
    appAlertCancelBtn.textContent = cancelText;
    appAlertCancelBtn.classList.remove('hidden');
    appAlertConfirmBtn.textContent = confirmText;
    appAlertConfirmBtn.classList.toggle('app-alert-danger', danger);
    appAlertModal.classList.remove('hidden');

    return new Promise((resolve) => {
        appAlertResolver = resolve;
    });
};

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

const encryptForStorage = async (plainText) => {
    return btoa(unescape(encodeURIComponent(plainText)));
};

const decryptFromStorage = async (payload) => {
    if (!payload) return '';
    return decodeURIComponent(escape(atob(payload)));
};

const persistGoogleKeyIfAllowed = async () => {
    if (!googleVisionApiKeyInput) return;
    const keyValue = getGoogleVisionApiKey();

    // Remove persisted key when field is cleared
    if (!keyValue) {
        localStorage.removeItem(GOOGLE_KEY_STORAGE_KEY);
        return;
    }

    // Ask consent only when user is actively trying to use/save Google key
    if (!isGoogleVisionSelected()) return;
    const allowed = await ensureGoogleKeyStorageConsent();
    if (!allowed) return;

    try {
        const encrypted = await encryptForStorage(keyValue);
        localStorage.setItem(GOOGLE_KEY_STORAGE_KEY, encrypted);
    } catch (err) {
        console.error('Failed to encrypt/store Google key:', err);
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
        const encrypted = await encryptForStorage(keyValue);
        localStorage.setItem(OPENROUTER_KEY_STORAGE_KEY, encrypted);
    } catch (err) {
        console.error('Failed to encrypt/store OpenRouter key:', err);
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

    if (getGoogleStorageConsent() === 'accepted') {
        try {
            const encrypted = localStorage.getItem(GOOGLE_KEY_STORAGE_KEY);
            if (encrypted) {
                const decrypted = await decryptFromStorage(encrypted);
                if (decrypted) googleVisionApiKeyInput.value = decrypted;
            }
        } catch (err) {
            console.warn('Failed to decrypt stored Google key:', err);
            localStorage.removeItem(GOOGLE_KEY_STORAGE_KEY);
        }
    }

    if (getOpenRouterStorageConsent() === 'accepted') {
        try {
            const encrypted = localStorage.getItem(OPENROUTER_KEY_STORAGE_KEY);
            if (encrypted) {
                const decrypted = await decryptFromStorage(encrypted);
                if (decrypted) openRouterApiKeyInput.value = decrypted;
            }
        } catch (err) {
            console.warn('Failed to decrypt stored OpenRouter key:', err);
            localStorage.removeItem(OPENROUTER_KEY_STORAGE_KEY);
        }
    }
};

// --- File Handling ---
const handleFileSelect = async (e) => {
    if (batchProgress.running) return;
    const newFiles = Array.from(e.target.files);
    if (newFiles.length === 0) return;

    // Show loading state if needed
    // addFilesBtn.disabled = true;
    // addFilesBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> processing...';

    for (const file of newFiles) {
        // Just add the file, processing happens on "Start"
        addFileToState(file, file.name);
    }

    renderFileList();

    // Auto-select first new file
    if (!activeFileId && filesData.length > 0) {
        selectFile(filesData[filesData.length - 1].id);
    }

    fileInput.value = '';
    // addFilesBtn.disabled = false;
    // addFilesBtn.innerHTML = '<i class="fas fa-plus"></i> Add Files';
    updateGlobalButtons();
};

/*
const processPdfFile = async (file) => {
    try {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 }); // High res for OCR
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const imageFile = new File([blob], `${file.name}_page_${i}.png`, { type: 'image/png' });

            addFileToState(imageFile, `${file.name} - Page ${i}`);
        }
    } catch (err) {
        console.error("Error processing PDF:", err);
        showAppAlert(`Failed to process PDF: ${file.name}`, { title: 'Processing Error' });
    }
};
*/

const addFileToState = (file, name) => {
    const id = crypto.randomUUID();
    const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
    const fileObj = {
        id,
        file,
        name: name,
        type: isPdf ? 'pdf' : 'image',
        status: 'pending', // pending, processing, done, error
        text: '', // For images
        pages: [], // For PDFs: [{ pageNum, imgUrl, text }]
        currentPage: 0, // 0-indexed
        startPage: null, // For PDFs
        endPage: null, // For PDFs
        totalPages: null, // For PDFs
        columnConfig: { active: false, numColumns: 1, splitPositions: [] }, // Per-file column split config
        rotation: 0, // 0, 90, 180, 270
        activeViewerPage: 1, // For tracking the actual visible page in the custom PDF DOM viewer
        // Use a generic placeholder or the image URL
        previewUrl: isPdf ? 'https://placehold.co/50x70?text=PDF' : URL.createObjectURL(file),
        pdfViewerUrl: isPdf ? URL.createObjectURL(file) : null
    };

    // If it's a PDF, try to generate a thumbnail immediately
    if (isPdf) {
        generatePdfThumbnail(fileObj);
    }

    filesData.push(fileObj);
};

const generatePdfThumbnail = async (fileObj, pageNum = 1) => {
    try {
        const arrayBuffer = await fileObj.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        fileObj.totalPages = pdf.numPages;

        // Ensure requested page exists
        const safePageNum = Math.min(Math.max(1, pageNum), pdf.numPages);
        const page = await pdf.getPage(safePageNum);

        const viewport = page.getViewport({ scale: 1.5 }); // High-definition scale for split preview
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const thumbUrl = URL.createObjectURL(blob);

        // Update state
        fileObj.previewUrl = thumbUrl;

        // Update UI if this file is in the list
        const imgEl = document.querySelector(`div[onclick*="${fileObj.id}"] img`);
        if (imgEl) imgEl.src = thumbUrl;

        // If this file is currently active/selected, update the main preview too (if it was showing the placeholder)
        if (activeFileId === fileObj.id) {
            renderPreview();
        }

    } catch (err) {
        console.error("Error generating PDF thumbnail:", err);
    }
};

const selectFile = (id) => {
    activeFileId = id;
    const file = filesData.find(f => f.id === id);
    syncColumnsFromFile(file);
    updateColumnsButtonUI();
    resetZoomPan();
    renderFileList(); // Update active class
    renderPreview();
    renderResult();
    requestAnimationFrame(() => fitImageInPreview());
};

const revokeFileResources = (file) => {
    if (!file) return;

    if (file.previewUrl && file.previewUrl !== 'https://placehold.co/50x70?text=PDF') {
        URL.revokeObjectURL(file.previewUrl);
    }
    if (file.pdfViewerUrl) {
        URL.revokeObjectURL(file.pdfViewerUrl);
    }
    if (Array.isArray(file.pages)) {
        file.pages.forEach(page => {
            if (page.imgUrl) URL.revokeObjectURL(page.imgUrl);
        });
    }
};

const clearAll = () => {
    if (batchProgress.running) return;
    filesData.forEach(revokeFileResources);
    filesData = [];
    activeFileId = null;
    globalColumnsConfigs = { active: false, numColumns: 1, splitPositions: [] };
    updateColumnsButtonUI();
    closeReviewModal();
    resetBatchProgressUI();
    renderFileList();
    renderPreview();
    renderResult();
    updateGlobalButtons();
};

const removeFile = (id) => {
    if (batchProgress.running) return;
    const fileIndex = filesData.findIndex(f => f.id === id);
    if (fileIndex !== -1) {
        revokeFileResources(filesData[fileIndex]);
        filesData.splice(fileIndex, 1);

        if (activeFileId === id) {
            activeFileId = null;
            if (filesData.length > 0) {
                const nextIndex = Math.min(fileIndex, filesData.length - 1);
                selectFile(filesData[nextIndex].id);
                return;
            } else {
                renderPreview();
                renderResult();
            }
        }
        renderFileList();
        updateGlobalButtons();
    }
};

// --- Settings Modal ---
let settingsFileId = null;
let settingsRotation = 0;

const getPdfTotalPages = async (file) => {
    if (file.totalPages && file.totalPages > 0) {
        return file.totalPages;
    }
    const arrayBuffer = await file.file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
    file.totalPages = pdf.numPages;
    return file.totalPages;
};

const openSettings = async (id) => {
    if (batchProgress.running) return;
    const file = filesData.find(f => f.id === id);
    if (!file) return;

    settingsFileId = id;
    settingsFileName.textContent = file.name;
    settingsModalTitle.textContent = file.type === 'pdf' ? 'PDF Settings' : 'Image Settings';
    pdfPageSettings.classList.toggle('hidden', file.type !== 'pdf');
    startPageInput.value = '';
    endPageInput.value = '';
    startPageInput.removeAttribute('max');
    endPageInput.removeAttribute('max');
    startPageInput.min = '1';
    endPageInput.min = '1';

    if (file.type === 'pdf') {
        try {
            const totalPages = await getPdfTotalPages(file);
            startPageInput.max = String(totalPages);
            endPageInput.max = String(totalPages);
            startPageInput.placeholder = `Leave empty (default 1, max ${totalPages})`;
            endPageInput.placeholder = `Leave empty (default ${totalPages})`;
            startPageInput.value = file.startPage ? String(file.startPage) : '';
            endPageInput.value = file.endPage ? String(file.endPage) : '';
            if (pdfPageHint) {
                pdfPageHint.textContent = `Total pages: ${totalPages}. Leave empty for full range (1-${totalPages}).`;
            }
        } catch (err) {
            console.error('Failed to load PDF page count:', err);
            startPageInput.placeholder = 'Leave empty (default 1)';
            endPageInput.placeholder = 'Leave empty (default max page)';
            startPageInput.value = file.startPage ? String(file.startPage) : '';
            endPageInput.value = file.endPage ? String(file.endPage) : '';
            if (pdfPageHint) {
                pdfPageHint.textContent = 'Leave both empty to process full PDF.';
            }
        }
    }

    setSettingsRotation(file.rotation || 0);

    settingsModal.classList.remove('hidden');
};

const closeSettings = () => {
    settingsModal.classList.add('hidden');
    settingsFileId = null;
    settingsRotation = 0;
    startPageInput.value = '';
    endPageInput.value = '';
};

const setSettingsRotation = (rotation) => {
    const normalized = [0, 90, 180, 270].includes(rotation) ? rotation : 0;
    settingsRotation = normalized;
    if (rotationHand) {
        rotationHand.style.transform = `translate(-50%, -100%) rotate(${normalized}deg)`;
    }
    rotationPoints.forEach((point) => {
        point.classList.toggle('active', parseInt(point.dataset.rotation, 10) === normalized);
    });
};

const applyRotationToFile = (file, rotation, showResetToast = true) => {
    const previousRotation = file.rotation || 0;
    const nextRotation = [0, 90, 180, 270].includes(rotation) ? rotation : 0;
    if (previousRotation === nextRotation) return;

    file.rotation = nextRotation;

    const config = getFileColumnsConfig(file);
    if (config.numColumns > 1 || config.active) {
        file.columnConfig = { active: false, numColumns: 1, splitPositions: [] };
        if (file.id === activeFileId) {
            syncColumnsFromFile(file);
            updateColumnsButtonUI();
            renderPreview();
            updateGlobalButtons();
        }
        if (showResetToast) {
            showToast('Columns reset after rotation. Set columns again if needed.');
        }
    }
};

const applyPageSelectionToPdf = async (pdfFile, selectedStart, selectedEnd) => {
    if (selectedStart === null) {
        pdfFile.startPage = null;
    } else {
        pdfFile.startPage = selectedStart;
    }

    if (selectedEnd === null) {
        pdfFile.endPage = null;
        return;
    }

    const totalPages = await getPdfTotalPages(pdfFile);
    if (totalPages >= selectedEnd) {
        pdfFile.endPage = selectedEnd;
    }
    // If total pages are smaller than selectedEnd, keep existing endPage as-is.
};

const saveSettings = async () => {
    if (!settingsFileId) return;
    const file = filesData.find(f => f.id === settingsFileId);
    if (!file) {
        closeSettings();
        return;
    }

    const prevRotation = file.rotation || 0;
    const prevStartPage = file.startPage;
    const prevEndPage = file.endPage;
    let selectedStart = null;
    let selectedEnd = null;

    if (file.type === 'pdf') {
        selectedStart = startPageInput.value ? parseInt(startPageInput.value, 10) : null;
        selectedEnd = endPageInput.value ? parseInt(endPageInput.value, 10) : null;
        await applyPageSelectionToPdf(file, selectedStart, selectedEnd);
    }

    applyRotationToFile(file, settingsRotation);

    // Close settings modal FIRST so it doesn't overlap or interfere with alert modals
    closeSettings();

    // Now trigger the alerts if needed
    if (file.type === 'pdf') {
        const totalPdfFiles = filesData.filter((f) => f.type === 'pdf').length;
        const pageSelectionChanged = prevStartPage !== file.startPage || prevEndPage !== file.endPage;
        if (totalPdfFiles > 1 && pageSelectionChanged) {
            const applyToRestPages = await showAppConfirm(
                'Apply this page selection to other uploaded PDFs?\n\nRule:\n- Start applies to all (or clears if empty)\n- Empty End clears all\n- End 10 applies only where total pages >= 10, otherwise each PDF keeps its current end value.',
                { title: 'Apply Page Selection', confirmText: 'Apply to all PDFs', cancelText: 'This PDF only' }
            );

            if (applyToRestPages) {
                for (const pdfFile of filesData) {
                    if (pdfFile.type !== 'pdf' || pdfFile.id === file.id) continue;
                    await applyPageSelectionToPdf(pdfFile, selectedStart, selectedEnd);
                }
            }
        }
    }

    const rotationChanged = prevRotation !== (file.rotation || 0);
    if (rotationChanged && filesData.length > 1) {
        const applyRotationToRest = await showAppConfirm(
            'Apply this rotation to other uploaded files?',
            { title: 'Apply Rotation', confirmText: 'Apply to all', cancelText: 'This file only' }
        );

        if (applyRotationToRest) {
            for (const target of filesData) {
                if (target.id === file.id) continue;
                applyRotationToFile(target, settingsRotation, false);
            }
            showToast('Rotation applied to all files.');
        }
    }

    renderPreview();
    renderResult();
};

// --- Rendering ---
const renderFileList = () => {
    fileList.innerHTML = '';
    fileCountSpan.textContent = filesData.length;

    if (filesData.length === 0) {
        fileList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-cloud-upload-alt"></i>
                <p>Drop files here</p>
            </div>`;
        return;
    }

    // Prepend "Add More" item
    const addMoreItem = document.createElement('div');
    addMoreItem.className = 'file-item add-more-item';
    addMoreItem.innerHTML = `
        <i class="fas fa-plus"></i>
        <span class="file-name">Add more files</span>
    `;
    addMoreItem.onclick = () => {
        if (batchProgress.running) return;
        fileInput.click();
    };
    fileList.appendChild(addMoreItem);

    filesData.forEach(file => {
        const item = document.createElement('div');
        item.className = `file-item ${file.id === activeFileId ? 'active' : ''}`;
        item.onclick = () => selectFile(file.id);

        let statusIcon = '';
        if (file.status === 'processing') statusIcon = '<div class="status-overlay"><i class="fas fa-spinner fa-spin"></i></div>';
        else if (file.status === 'done') statusIcon = '<div class="status-overlay done"><i class="fas fa-check"></i></div>';
        else if (file.status === 'error') statusIcon = '<div class="status-overlay error"><i class="fas fa-exclamation"></i></div>';

        const controlDisabledAttr = batchProgress.running ? 'disabled' : '';
        const settingsButtonHtml = `
            <button class="settings-file-btn" title="File Settings" ${controlDisabledAttr} onclick="event.stopPropagation(); openSettings('${file.id}')">
                <i class="fas fa-cog"></i>
            </button>
        `;

        item.innerHTML = `
            <button class="remove-file-btn" title="Remove File" ${controlDisabledAttr} onclick="event.stopPropagation(); removeFile('${file.id}')">
                <i class="fas fa-trash"></i>
            </button>
            ${settingsButtonHtml}
            <img src="${file.previewUrl}" class="file-thumb" alt="${file.name}" onerror="this.src='https://placehold.co/50x70?text=PDF'">
            ${statusIcon}
            <div class="file-info-col">
                 <span class="file-name" title="${file.name}">${file.name}</span>
            </div>
        `;
        fileList.appendChild(item);
    });
};

const resetZoomPan = () => {
    zoomLevel = 1;
    panX = 0;
    panY = 0;
};

const fitImageInPreview = () => {
    const img = previewContainer.querySelector('.preview-image');
    if (!img) {
        applyTransform();
        return;
    }

    const applyFit = () => {
        const containerRect = previewContainer.getBoundingClientRect();
        const currentZoom = zoomLevel || 1;
        const imgRect = img.getBoundingClientRect();
        if (!containerRect.width || !containerRect.height || !imgRect.width || !imgRect.height) {
            applyTransform();
            return;
        }

        const baseWidth = imgRect.width / currentZoom;
        const baseHeight = imgRect.height / currentZoom;
        const fitScale = Math.min(containerRect.width / baseWidth, containerRect.height / baseHeight);

        zoomLevel = Math.max(0.2, Math.min(1, fitScale));
        const centeredPanX = (containerRect.width * (1 - zoomLevel)) / 2;
        const centeredPanY = (containerRect.height * (1 - zoomLevel)) / 2;
        panX = centeredPanX;
        panY = centeredPanY + 8; // keep a small breathing space below top bar
        applyTransform();
    };

    if (img.complete) {
        applyFit();
    } else {
        img.addEventListener('load', applyFit, { once: true });
    }
};

const recenterPreviewView = () => {
    resetZoomPan();
    renderPreview();
    renderResult();
    requestAnimationFrame(() => fitImageInPreview());
};

const applyTransform = () => {
    const viewport = previewContainer.querySelector('.preview-viewport');
    if (viewport) {
        viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
};

const handleZoomWheel = (e) => {
    if (e.target.closest('.pdf-custom-viewer')) return; // Allow native scroll inside custom PDF viewer
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel = Math.min(5, Math.max(0.2, zoomLevel + delta));
    applyTransform();
};

const handlePanStart = (e) => {
    if (e.target.closest('.zoom-controls') || e.target.closest('.pdf-custom-viewer')) return;
    isPanning = true;
    panStartX = e.clientX - panX;
    panStartY = e.clientY - panY;
    previewContainer.classList.add('grabbing');
};

const handlePanMove = (e) => {
    if (!isPanning) return;
    panX = e.clientX - panStartX;
    panY = e.clientY - panStartY;
    applyTransform();
};

const handlePanEnd = () => {
    isPanning = false;
    previewContainer.classList.remove('grabbing');
};

const zoomIn = () => {
    zoomLevel = Math.min(5, zoomLevel + 0.25);
    applyTransform();
};

const zoomOut = () => {
    zoomLevel = Math.max(0.2, zoomLevel - 0.25);
    applyTransform();
};

const zoomReset = () => {
    fitImageInPreview();
};

const renderPreview = () => {
    const file = filesData.find(f => f.id === activeFileId);
    previewContainer.innerHTML = '';
    previewName.textContent = file ? file.name : 'No file selected';

    const paginationControls = document.getElementById('paginationControls');
    const pageIndicator = document.getElementById('pageIndicator');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');

    if (!file) {
        paginationControls.classList.add('hidden');
        previewContainer.innerHTML = '<div class="empty-preview"><p>Select a file to preview</p></div>';
        return;
    }

    let src = '';

    if (file.type === 'pdf') {
        const page = file.pages[file.currentPage];

        if (file.pages.length > 0) {
            paginationControls.classList.remove('hidden');
            pageIndicator.textContent = `Page ${file.currentPage + 1} of ${file.pages.length}`;
            prevPageBtn.disabled = file.currentPage === 0;
            nextPageBtn.disabled = file.currentPage === file.pages.length - 1;

            if (page && page.imgUrl) {
                src = page.imgUrl;
            } else {
                previewContainer.innerHTML = '<div class="empty-preview"><p>Processing page...</p></div>';
                return;
            }
        } else {
            paginationControls.classList.add('hidden');
            // Show custom viewer if no columns, OR if columns are confirmed and locked in
            const showCustomViewer = file.type === 'pdf'
                && file.rotation === 0
                && (globalColumnsConfigs.numColumns === 1 || globalColumnsConfigs.active);

            if (showCustomViewer) {
                paginationControls.classList.remove('hidden');
                pageIndicator.textContent = `Page ${file.activeViewerPage || 1} of ...`;
                prevPageBtn.disabled = true;
                nextPageBtn.disabled = true;

                // Render our custom scrolling PDF.js viewer instead of a native <object> tag
                previewContainer.innerHTML = '<div class="pdf-custom-viewer" id="customPdfViewer"></div>';
                const customViewer = document.getElementById('customPdfViewer');

                // Fetch the PDF to know how many pages
                file.file.arrayBuffer().then(arrayBuffer => {
                    return pdfjsLib.getDocument(arrayBuffer).promise;
                }).then(pdf => {
                    const totalPages = pdf.numPages;
                    const safeActivePage = Math.min(Math.max(file.activeViewerPage || 1, 1), totalPages);
                    file.activeViewerPage = safeActivePage;
                    pageIndicator.textContent = `Page ${safeActivePage} of ${totalPages}`;

                    // Create an intersection observer to detect active page and trigger rendering
                    const observer = new IntersectionObserver((entries) => {
                        let mostVisiblePage = file.activeViewerPage;
                        let maxRatio = 0;

                        entries.forEach(entry => {
                            // If it's intersecting, and hasn't been rendered yet, render it
                            const pageNum = parseInt(entry.target.dataset.page);
                            if (entry.isIntersecting) {
                                if (!entry.target.dataset.rendered) {
                                    entry.target.dataset.rendered = 'true';
                                    entry.target.innerHTML = ''; // Clear placeholder text
                                    const canvas = document.createElement('canvas');
                                    entry.target.appendChild(canvas);

                                    pdf.getPage(pageNum).then(page => {
                                        const viewport = page.getViewport({ scale: 1.5 });
                                        canvas.height = viewport.height;
                                        canvas.width = viewport.width;
                                        // Keep container size matched exactly to canvas
                                        entry.target.style.height = viewport.height + 'px';

                                        const context = canvas.getContext('2d');
                                        page.render({ canvasContext: context, viewport: viewport });
                                    });
                                }

                                // Track which page is most visible
                                if (entry.intersectionRatio > maxRatio) {
                                    maxRatio = entry.intersectionRatio;
                                    mostVisiblePage = pageNum;
                                }
                            }
                        });

                        if (maxRatio > 0 && mostVisiblePage !== file.activeViewerPage) {
                            file.activeViewerPage = mostVisiblePage;
                            pageIndicator.textContent = `Page ${mostVisiblePage} of ${totalPages}`;
                        }
                    }, {
                        root: customViewer,
                        threshold: [0.1, 0.5, 0.9]
                    });

                    // Create placeholder boxes for every page
                    for (let i = 1; i <= pdf.numPages; i++) {
                        const pageContainer = document.createElement('div');
                        pageContainer.className = 'pdf-page-container';
                        pageContainer.dataset.page = i;
                        // Give it a generic minimum height so scrolling works initially before lazy load
                        pageContainer.style.height = '800px';
                        pageContainer.style.width = '100%';
                        pageContainer.style.maxWidth = '800px';

                        customViewer.appendChild(pageContainer);
                        observer.observe(pageContainer);
                    }

                    // Scroll to the last known active page if restarting viewer
                    if (file.activeViewerPage > 1) {
                        setTimeout(() => {
                            const target = customViewer.querySelector(`[data-page="${file.activeViewerPage}"]`);
                            if (target) {
                                target.scrollIntoView();
                            }
                        }, 100);
                    }
                }).catch(err => {
                    console.error("Error loading custom PDF viewer:", err);
                    previewContainer.innerHTML = '<div class="empty-preview"><p>Error loading PDF.</p></div>';
                });

                return;
            } else if (file.previewUrl && file.previewUrl !== 'https://placehold.co/50x70?text=PDF') {
                src = file.previewUrl;
                // Allow it to fall through to the image renderer below
            } else {
                previewContainer.innerHTML = '<div class="empty-preview"><p>Generating preview...</p></div>';
                return;
            }
        }
    } else {
        src = file.previewUrl;
        paginationControls.classList.add('hidden');
    }

    // Create viewport wrapper for zoom/pan
    const viewport = document.createElement('div');
    viewport.className = 'preview-viewport';
    viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    viewport.id = 'previewViewport';

    const imgWrapper = document.createElement('div');
    imgWrapper.className = 'preview-image-wrapper';

    const img = document.createElement('img');
    img.src = src;
    img.className = 'preview-image';
    const shouldRotateWithCss = !(file.type === 'pdf' && file.pages.length > 0);
    if (shouldRotateWithCss) {
        const rotation = file.rotation || 0;
        img.style.transform = `rotate(${rotation}deg)`;
        img.style.transformOrigin = 'center center';

        const applyRotationScale = () => {
            if (rotation === 90 || rotation === 270) {
                const cw = previewContainer.clientWidth;
                const ch = previewContainer.clientHeight;
                const rw = img.width;
                const rh = img.height;
                if (rw > 0 && rh > 0 && cw > 0 && ch > 0) {
                    const scaleX = cw / rh;
                    const scaleY = ch / rw;
                    const scale = Math.min(scaleX, scaleY, 1);
                    img.style.transform = `rotate(${rotation}deg) scale(${scale})`;
                }
            }
        };

        if (img.complete) {
            applyRotationScale();
        } else {
            img.onload = applyRotationScale;
        }
    }

    imgWrapper.appendChild(img);
    viewport.appendChild(imgWrapper);

    // Render splitters if active
    if (globalColumnsConfigs.numColumns > 1) {
        globalColumnsConfigs.splitPositions.forEach((pos, index) => {
            const splitter = document.createElement('div');
            splitter.className = 'column-splitter';
            splitter.style.left = `${pos * 100}%`;
            splitter.dataset.index = index;

            // If confirm hasn't been clicked, they are draggable
            if (!globalColumnsConfigs.active) {
                setupSplitterDrag(splitter, imgWrapper);
            } else {
                splitter.style.pointerEvents = 'none';
            }

            imgWrapper.appendChild(splitter);
        });
    }

    previewContainer.appendChild(viewport);

    // Add zoom controls
    const zoomCtrl = document.createElement('div');
    zoomCtrl.className = 'zoom-controls';
    zoomCtrl.innerHTML = `
        <button onclick="zoomIn()" title="Zoom In"><i class="fas fa-search-plus"></i></button>
        <button onclick="zoomOut()" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
        <button onclick="zoomReset()" title="Reset"><i class="fas fa-expand"></i></button>
    `;
    previewContainer.appendChild(zoomCtrl);
};

// --- Columns & Splitting Logic ---
const setupColumns = (cols) => {
    globalColumnsConfigs.numColumns = cols;
    if (cols === 1) {
        globalColumnsConfigs.active = false;
        globalColumnsConfigs.splitPositions = [];
    } else {
        globalColumnsConfigs.active = false; // Not confirmed yet
        globalColumnsConfigs.splitPositions = [];
        // Distribute evenly
        for (let i = 1; i < cols; i++) {
            globalColumnsConfigs.splitPositions.push(i / cols);
        }
    }

    const activeFile = filesData.find(f => f.id === activeFileId);
    syncColumnsToFile(activeFile);
    updateColumnsButtonUI();

    // Render preview to show/hide splitters
    recenterPreviewView();
    updateGlobalButtons(); // Re-eval Process Button state
};

const setupSplitterDrag = (splitter, container) => {
    let isDragging = false;

    splitter.addEventListener('mousedown', (e) => {
        isDragging = true;
        splitter.classList.add('dragging');
        // Prevent pan handling
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = container.getBoundingClientRect();
        // Calculate raw x position relative to scaled container
        let x = (e.clientX - rect.left) / zoomLevel;
        // Convert to percentage
        let percentage = x / (rect.width / zoomLevel);

        // Boundaries
        percentage = Math.max(0.01, Math.min(0.99, percentage));

        const index = parseInt(splitter.dataset.index, 10);

        // Prevent crossing neighbors
        const minPos = index > 0 ? globalColumnsConfigs.splitPositions[index - 1] + 0.02 : 0.01;
        const maxPos = index < globalColumnsConfigs.splitPositions.length - 1 ? globalColumnsConfigs.splitPositions[index + 1] - 0.02 : 0.99;

        percentage = Math.max(minPos, Math.min(maxPos, percentage));

        globalColumnsConfigs.splitPositions[index] = percentage;
        const activeFile = filesData.find(f => f.id === activeFileId);
        syncColumnsToFile(activeFile);
        splitter.style.left = `${percentage * 100}%`;
    });

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            splitter.classList.remove('dragging');
        }
    });
};

const navigatePage = (direction) => {
    const file = filesData.find(f => f.id === activeFileId);
    if (!file || file.type !== 'pdf' || file.pages.length === 0) return;

    const newPage = file.currentPage + direction;
    if (newPage < 0 || newPage >= file.pages.length) return;

    // Keep current zoom/pan when changing page so the new page inherits last page view state
    file.currentPage = newPage;
    renderPreview();
    renderResult();
};

const renderResult = () => {
    const file = filesData.find(f => f.id === activeFileId);
    if (!file) {
        outputText.value = '';
        outputText.disabled = true;
        updateGlobalButtons();
        return;
    }

    if (file.type === 'pdf') {
        const page = file.pages[file.currentPage];
        outputText.value = page ? page.text : '';
    } else {
        outputText.value = file.text;
    }

    outputText.disabled = false;
    updateGlobalButtons();
};

const updateGlobalButtons = () => {
    const hasFiles = filesData.length > 0;
    const hasDoneFiles = filesData.some(f => f.status === 'done');
    const allProcessed = hasFiles && filesData.every(f => f.status === 'done' || f.status === 'error');
    const hasErrorFiles = filesData.some(f => f.status === 'error');
    const isProcessing = batchProgress.running || filesData.some(f => f.status === 'processing');
    const isConfiguringColumns = globalColumnsConfigs.numColumns > 1 && !globalColumnsConfigs.active;
    const googleKeyMissing = isGoogleVisionSelected() && !getGoogleVisionApiKey();
    const openRouterKeyMissing = isOpenRouterSelected() && !getOpenRouterApiKey();
    const openRouterCustomModelMissing = isOpenRouterCustomSelected() && (openRouterCustomModelInput?.value || '').trim() === '';
    const isStartBlockedByConfig = isConfiguringColumns || googleKeyMissing || openRouterKeyMissing || openRouterCustomModelMissing;

    if (processBtn) {
        processBtn.disabled = !hasFiles || isProcessing || isStartBlockedByConfig;
        processBtn.classList.toggle('disabled', processBtn.disabled);
        if (isProcessing) {
            processBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Processing All...';
        } else if (allProcessed) {
            if (hasErrorFiles) {
                processBtn.innerHTML = '<i class="fas fa-rotate-right"></i> Restart Processing';
            } else {
                processBtn.innerHTML = '<i class="fas fa-trash-alt"></i> Clear Files';
            }
        } else if (isConfiguringColumns) {
            processBtn.innerHTML = '<i class="fas fa-play"></i> Confirm Columns First';
        } else if (googleKeyMissing) {
            processBtn.innerHTML = '<i class="fas fa-key"></i> Add Google API Key';
        } else if (openRouterKeyMissing) {
            processBtn.innerHTML = '<i class="fas fa-key"></i> Add OpenRouter API Key';
        } else {
            processBtn.innerHTML = '<i class="fas fa-play"></i> Start OCR Processing (All)';
        }
    }

    if (clearAllBtn) clearAllBtn.disabled = !hasFiles || isProcessing;
    if (downloadAllBtn) downloadAllBtn.disabled = !hasDoneFiles || isProcessing;
    if (addFilesBtn) addFilesBtn.disabled = isProcessing;
    if (fileInput) fileInput.disabled = isProcessing;
    if (selectColumnsBtn) selectColumnsBtn.disabled = !hasFiles || isProcessing;
    if (languageSelect) languageSelect.disabled = isProcessing;
    if (ocrEngineSelect) ocrEngineSelect.disabled = isProcessing;
    if (openRouterOutputFormatSelect) openRouterOutputFormatSelect.disabled = isProcessing || !isOpenRouterGemmaSelected();
    if (googleVisionApiKeyInput) googleVisionApiKeyInput.disabled = isProcessing || !isGoogleVisionSelected();
    if (openRouterApiKeyInput) openRouterApiKeyInput.disabled = isProcessing || !isOpenRouterGemmaSelected();
};

// --- Actions ---
const handleProcessClick = () => {
    if (batchProgress.running || filesData.length === 0) return;
    const allProcessed = filesData.every(f => f.status === 'done' || f.status === 'error');
    const hasErrorFiles = filesData.some(f => f.status === 'error');
    if (allProcessed) {
        if (hasErrorFiles) {
            showAppConfirm(
                'Some files have errors. Restart OCR processing for all files?',
                { title: 'Restart Processing', confirmText: 'Restart', cancelText: 'Cancel' }
            ).then((confirmRestart) => {
                if (confirmRestart) openReviewModal();
            });
        } else {
            showAppConfirm('Clear all files from the queue?', { title: 'Clear Files', confirmText: 'Clear', danger: true })
                .then((confirmClear) => {
                    if (confirmClear) clearAll();
                });
        }
        return;
    }
    if (globalColumnsConfigs.numColumns > 1 && !globalColumnsConfigs.active) return;
    if (isGoogleVisionSelected() && !getGoogleVisionApiKey()) {
        showAppAlert('Please enter your Google Vision API key first.', { title: 'Google Vision API Key' });
        return;
    }
    if (isOpenRouterSelected() && !getOpenRouterApiKey()) {
        showAppAlert('Please enter your OpenRouter API key first.', { title: 'OpenRouter API Key' });
        return;
    }
    if (isOpenRouterCustomSelected() && (!openRouterCustomModelInput || !openRouterCustomModelInput.value.trim())) {
        showAppAlert('Please enter a custom OpenRouter model string (e.g. anthropic/claude-3-haiku).', { title: 'Missing Custom Model' });
        return;
    }
    openReviewModal();
};

const openReviewModal = () => {
    const selectedLanguage = languageSelect.options[languageSelect.selectedIndex]?.text || languageSelect.value;
    const selectedEngine = ocrEngineSelect.options[ocrEngineSelect.selectedIndex]?.text || ocrEngineSelect.value;
    const columnCount = (globalColumnsConfigs.active && globalColumnsConfigs.numColumns > 1) ? globalColumnsConfigs.numColumns : 1;
    const itemLabel = filesData.length === 1 ? 'item' : 'items';

    reviewLanguage.textContent = selectedLanguage;
    reviewColumns.textContent = String(columnCount);
    reviewSelectionCount.textContent = `${filesData.length} ${itemLabel}`;
    reviewEngine.textContent = selectedEngine;
    reviewModal.classList.remove('hidden');
};

const closeReviewModal = () => {
    reviewModal.classList.add('hidden');
};

const openExportModal = () => {
    const filesToExport = collectDoneFilesForExport();
    if (filesToExport.length === 0) return;
    exportModal.classList.remove('hidden');
};

const closeExportModal = () => {
    exportModal.classList.add('hidden');
};

const startProgressTimer = () => {
    stopProgressTimer();
    progressTimerId = setInterval(() => {
        updateOverallProgressUI();
    }, 1000);
};

const stopProgressTimer = () => {
    if (progressTimerId) {
        clearInterval(progressTimerId);
        progressTimerId = null;
    }
};

const resetBatchProgressUI = () => {
    stopProgressTimer();
    batchProgress = {
        running: false,
        totalFiles: 0,
        completedFiles: 0,
        startedAt: 0,
        currentFileName: '',
        lastRunDurationMs: 0
    };
    updateOverallProgressUI();
};

const formatDuration = (durationMs) => {
    const totalSeconds = Math.max(0, Math.round(durationMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
};

const updateOverallProgressUI = () => {
    if (!overallProgress) return;

    if (batchProgress.totalFiles === 0) {
        overallProgress.classList.add('hidden');
        overallProgressFill.style.width = '0%';
        overallProgressText.textContent = 'Overall: 0 / 0';
        overallEtaText.textContent = 'ETA --';
        overallProgressCurrent.textContent = 'Waiting to start...';
        return;
    }

    overallProgress.classList.remove('hidden');
    const percent = Math.round((batchProgress.completedFiles / batchProgress.totalFiles) * 100);
    overallProgressFill.style.width = `${percent}%`;
    overallProgressText.textContent = `Overall: ${batchProgress.completedFiles} / ${batchProgress.totalFiles} (${percent}%)`;

    if (batchProgress.running) {
        if (batchProgress.completedFiles > 0) {
            const elapsedMs = Date.now() - batchProgress.startedAt;
            const avgMsPerFile = elapsedMs / batchProgress.completedFiles;
            const remainingFiles = batchProgress.totalFiles - batchProgress.completedFiles;
            overallEtaText.textContent = `ETA ${formatDuration(avgMsPerFile * remainingFiles)}`;
        } else {
            overallEtaText.textContent = 'ETA calculating...';
        }
        overallProgressCurrent.textContent = batchProgress.currentFileName ? `Current: ${batchProgress.currentFileName}` : 'Starting...';
    } else {
        overallEtaText.textContent = `Done in ${formatDuration(batchProgress.lastRunDurationMs)}`;
        overallProgressCurrent.textContent = 'All selected items are processed.';
    }
};

const prepareFileForProcessing = (file) => {
    if (file.type === 'pdf') {
        file.pages.forEach(page => {
            if (page.imgUrl) URL.revokeObjectURL(page.imgUrl);
        });
        file.pages = [];
        file.currentPage = 0;
    } else {
        file.text = '';
    }
    file.status = 'processing';
};

const startBatchProcessing = async () => {
    if (batchProgress.running) return;

    const filesToProcess = [...filesData];
    if (filesToProcess.length === 0) {
        closeReviewModal();
        return;
    }

    closeReviewModal();
    batchProgress = {
        running: true,
        totalFiles: filesToProcess.length,
        completedFiles: 0,
        startedAt: Date.now(),
        currentFileName: '',
        lastRunDurationMs: 0
    };
    updateOverallProgressUI();
    updateGlobalButtons();
    startProgressTimer();

    if (!activeFileId) {
        activeFileId = filesToProcess[0].id;
    }

    for (const file of filesToProcess) {
        batchProgress.currentFileName = file.name;
        prepareFileForProcessing(file);
        activeFileId = file.id;
        renderFileList();
        renderPreview();
        renderResult();
        updateOverallProgressUI();

        try {
            if (file.type === 'pdf') {
                await processPdfDocument(file);
            } else {
                await processSingleImage(file);
            }
        } catch (err) {
            console.error('File processing error:', err);
            file.status = 'error';
            if (file.type !== 'pdf') {
                file.text = 'Error: Connection failed';
            }
            renderFileList();
            renderResult();
            updateGlobalButtons();
        }

        batchProgress.completedFiles += 1;
        updateOverallProgressUI();
    }

    batchProgress.running = false;
    batchProgress.currentFileName = '';
    batchProgress.lastRunDurationMs = Date.now() - batchProgress.startedAt;
    stopProgressTimer();
    updateOverallProgressUI();
    updateGlobalButtons();
};

const processSingleImage = async (file) => {
    try {
        const sourceBlob = file.file;
        const workingBlob = await rotateImageBlob(sourceBlob, file.rotation || 0);
        const fileColumns = getFileColumnsConfig(file);

        if (fileColumns.active && fileColumns.numColumns > 1) {
            // Process columns sequentially
            const textParts = [];
            const splits = [0, ...fileColumns.splitPositions, 1];

            for (let i = 0; i < splits.length - 1; i++) {
                const startPct = splits[i];
                const endPct = splits[i + 1];
                const croppedBlob = await cropImageBlob(workingBlob, startPct, endPct);

                const formData = new FormData();
                formData.append('file', croppedBlob, `${file.name}_col_${i + 1}.png`);
                appendOcrConfigToFormData(formData);

                const response = await fetch('/api/ocr', { method: 'POST', body: formData });
                const data = await response.json();

                if (response.ok) {
                    textParts.push(data.text);
                } else {
                    textParts.push(`[Error in Column ${i + 1}: ${data.error || 'Unknown error'}]`);
                }
            }
            file.text = textParts.join('\n\n--- Column Break ---\n\n');
            file.status = 'done';

        } else {
            // Standard whole-image processing
            const formData = new FormData();
            formData.append('file', workingBlob, file.name);
            appendOcrConfigToFormData(formData);

            const response = await fetch('/api/ocr', { method: 'POST', body: formData });
            const data = await response.json();

            if (response.ok) {
                file.text = data.text;
                file.status = 'done';
            } else {
                file.text = "Error: " + (data.error || 'Unknown error');
                file.status = 'error';
            }
        }
    } catch (err) {
        console.error(err);
        file.text = "Error: Connection failed";
        file.status = 'error';
    }
    renderFileList();
    renderResult();
    updateGlobalButtons();
};

const processPdfDocument = async (file) => {
    try {
        const arrayBuffer = await file.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        file.totalPages = pdf.numPages;
        const fileColumns = getFileColumnsConfig(file);
        file.pages.forEach(page => {
            if (page.imgUrl) URL.revokeObjectURL(page.imgUrl);
        });
        file.pages = []; // Reset pages

        let start = file.startPage && file.startPage > 0 ? file.startPage : 1;
        let end = file.endPage && file.endPage > 0 && file.endPage <= pdf.numPages ? file.endPage : pdf.numPages;

        if (start > end) {
            start = 1;
            end = pdf.numPages;
        }

        const totalPagesToProcess = end - start + 1;

        for (let i = start; i <= end; i++) {
            if (batchProgress.running) {
                batchProgress.currentFileName = `${file.name} (page ${i - start + 1}/${totalPagesToProcess})`;
                updateOverallProgressUI();
            }

            const pageIndex = file.pages.length;
            file.currentPage = pageIndex; // Update current page index (0-based) to show progress

            // 1. Render Page to Blob
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2.0 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;
            await page.render({ canvasContext: context, viewport: viewport }).promise;

            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            const workingBlob = await rotateImageBlob(blob, file.rotation || 0);
            const imageUrl = URL.createObjectURL(workingBlob);

            // 2. Add to pages array (initially without text)
            file.pages.push({
                pageNum: i,
                imgUrl: imageUrl,
                text: 'Processing...'
            });

            renderPreview(); // Show new page image
            renderResult();  // Show "Processing..." in text area

            // 3. Send to OCR (handling columns if active)
            try {
                if (fileColumns.active && fileColumns.numColumns > 1) {
                    const textParts = [];
                    const splits = [0, ...fileColumns.splitPositions, 1];

                    for (let c = 0; c < splits.length - 1; c++) {
                        const startPct = splits[c];
                        const endPct = splits[c + 1];
                        const croppedBlob = await cropImageBlob(workingBlob, startPct, endPct);

                        const formData = new FormData();
                        formData.append('file', croppedBlob, `page_${i}_col_${c + 1}.png`);
                        appendOcrConfigToFormData(formData);

                        const response = await fetch('/api/ocr', { method: 'POST', body: formData });
                        const data = await response.json();

                        if (response.ok) {
                            textParts.push(data.text);
                        } else {
                            textParts.push(`[Error in Column ${c + 1}: ${data.error || 'Unknown error'}]`);
                        }
                    }
                    file.pages[pageIndex].text = textParts.join('\n\n--- Column Break ---\n\n');
                } else {
                    const formData = new FormData();
                    formData.append('file', workingBlob, `page_${i}.png`);
                    appendOcrConfigToFormData(formData);

                    const response = await fetch('/api/ocr', { method: 'POST', body: formData });
                    const data = await response.json();
                    if (response.ok) {
                        file.pages[pageIndex].text = data.text;
                    } else {
                        file.pages[pageIndex].text = "Error: " + (data.error || 'Unknown error');
                    }
                }
            } catch (err) {
                file.pages[pageIndex].text = "Error: Connection failed";
            }

            renderResult(); // Update text area with result
        }

        if (batchProgress.running) {
            batchProgress.currentFileName = file.name;
        }
        file.status = 'done';
    } catch (err) {
        console.error("PDF Processing Error:", err);
        file.status = 'error';
        await showAppAlert(`Failed to process PDF: ${err.message || err}`, { title: 'Processing Error' });
    }

    renderFileList();
    renderPreview(); // Ensure controls are updated
    renderResult();  // Update the processing button state specifically
    updateGlobalButtons();
};

const showToast = (message, duration = 2500) => {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
        toast.classList.remove('show');
    }, duration);
};

const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText.value).then(() => {
        showToast('Copied to clipboard!');
    });
};

const collectDoneFilesForExport = () => {
    const filesToExport = [];
    filesData.forEach(f => {
        if (f.status !== 'done') return;

        if (f.type === 'pdf') {
            f.pages.forEach(p => {
                if (p.text) {
                    filesToExport.push({
                        filename: `${f.name}_page_${p.pageNum}.txt`,
                        text: p.text
                    });
                }
            });
            return;
        }

        if (f.text) {
            filesToExport.push({
                filename: `${f.name}.txt`,
                text: f.text
            });
        }
    });
    return filesToExport;
};

const downloadCombinedTxt = () => {
    const filesToExport = collectDoneFilesForExport();
    if (filesToExport.length === 0) return;
    closeExportModal();

    const combinedText = filesToExport
        .map((item, index) => `===== ${item.filename} =====\n${item.text}`)
        .join('\n\n');

    const blob = new Blob([combinedText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ocr_results_combined_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
};

const downloadAllZip = async () => {
    const filesToZip = collectDoneFilesForExport();
    if (filesToZip.length === 0) return;
    closeExportModal();

    try {
        downloadAllBtn.textContent = 'Zipping...';

        const response = await fetch('/api/download-zip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ files: filesToZip })
        });

        if (response.ok) {
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'ocr_results_' + Date.now() + '.zip';
            a.click();
            URL.revokeObjectURL(url);
        } else {
            await showAppAlert('Failed to generate zip', { title: 'Export Error' });
        }
    } catch (err) {
        console.error(err);
        await showAppAlert('Download failed', { title: 'Export Error' });
    } finally {
        downloadAllBtn.innerHTML = '<i class="fas fa-file-export"></i> Export';
    }
};

// --- Utilities ---
const cropImageBlob = (blob, startPct, endPct) => {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            const cropX = img.width * startPct;
            const cropW = img.width * (endPct - startPct);

            canvas.width = cropW;
            canvas.height = img.height;

            ctx.drawImage(img, cropX, 0, cropW, img.height, 0, 0, cropW, img.height);
            canvas.toBlob((croppedBlob) => {
                resolve(croppedBlob);
            }, blob.type || 'image/png');
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
};

const rotateImageBlob = (blob, rotation = 0) => {
    const normalized = ((rotation % 360) + 360) % 360;
    if (![90, 180, 270].includes(normalized)) {
        return Promise.resolve(blob);
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const swapDimensions = normalized === 90 || normalized === 270;
            const canvas = document.createElement('canvas');
            canvas.width = swapDimensions ? img.height : img.width;
            canvas.height = swapDimensions ? img.width : img.height;

            const ctx = canvas.getContext('2d');
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.rotate((normalized * Math.PI) / 180);
            ctx.drawImage(img, -img.width / 2, -img.height / 2);
            canvas.toBlob((rotatedBlob) => {
                if (!rotatedBlob) {
                    reject(new Error('Failed to rotate image'));
                    return;
                }
                resolve(rotatedBlob);
            }, blob.type || 'image/png');
        };
        img.onerror = reject;
        img.src = URL.createObjectURL(blob);
    });
};

// Start
document.addEventListener('DOMContentLoaded', init);
