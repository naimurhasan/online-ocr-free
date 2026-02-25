// ── state.js ── All state variables and DOM references (loaded first)

let filesData = [];
let activeFileId = null;

let zoomLevel = 1;
let panX = 0;
let panY = 0;
let isPanning = false;
let panStartX = 0;
let panStartY = 0;

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
const geminiKeyWrap = document.getElementById('geminiKeyWrap');
const geminiApiKeyInput = document.getElementById('geminiApiKey');
const geminiCustomModelWrap = document.getElementById('geminiCustomModelWrap');
const geminiCustomModelInput = document.getElementById('geminiCustomModel');
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
const reviewConcurrencyRow = document.getElementById('reviewConcurrencyRow');
const reviewConcurrency = document.getElementById('reviewConcurrency');
const exportModal = document.getElementById('exportModal');
const cancelExportBtn = document.getElementById('cancelExportBtn');
const exportCombinedBtn = document.getElementById('exportCombinedBtn');
const exportZipBtn = document.getElementById('exportZipBtn');
const exportPdfBtn = document.getElementById('exportPdfBtn');
const emailProcessBtn = document.getElementById('emailProcessBtn');
const emailFormatZipBtn = document.getElementById('emailFormatZip');
const emailFormatPdfBtn = document.getElementById('emailFormatPdf');
const emailOtpModal = document.getElementById('emailOtpModal');
const emailInput = document.getElementById('emailInput');
const sendOtpBtn = document.getElementById('sendOtpBtn');
const emailStep1 = document.getElementById('emailStep1');
const emailStep2 = document.getElementById('emailStep2');
const otpSentEmail = document.getElementById('otpSentEmail');
const otpInput = document.getElementById('otpInput');
const verifyAndSendBtn = document.getElementById('verifyAndSendBtn');
const resendOtpBtn = document.getElementById('resendOtpBtn');
const emailError = document.getElementById('emailError');
const cancelEmailBtn = document.getElementById('cancelEmailBtn');
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

const advancedSettingsBtn = document.getElementById('advancedSettingsBtn');
const advancedSettingsModal = document.getElementById('advancedSettingsModal');
const cancelAdvSettingsBtn = document.getElementById('cancelAdvSettingsBtn');
const saveAdvSettingsBtn = document.getElementById('saveAdvSettingsBtn');
const resetAllSettingsBtn = document.getElementById('resetAllSettingsBtn');
const concurrentThreadsSlider = document.getElementById('concurrentThreadsSlider');
const concurrentThreadsValue = document.getElementById('concurrentThreadsValue');
const preprocessingToggle = document.getElementById('preprocessingToggle');
const customPromptInput = document.getElementById('customPromptInput');
const toggleDefaultPromptBtn = document.getElementById('toggleDefaultPromptBtn');
const defaultPromptDisplay = document.getElementById('defaultPromptDisplay');
const promptInfoIcon = document.getElementById('promptInfoIcon');

let serverMaxThreads = 4;
let serverDefaultPrompt = '';
let advancedSettings = {
    concurrentThreads: 1,
    customPrompt: '',
    skipPreprocessing: false
};

const ADVANCED_SETTINGS_KEY = 'ocr_magic_advanced_settings_v1';

let globalColumnsConfigs = {
    active: false,
    numColumns: 1,
    splitPositions: []
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

const getTrialKeyBtn = document.getElementById('getTrialKeyBtn');
const trialModal = document.getElementById('trialModal');
const trialEmailInput = document.getElementById('trialEmailInput');
const trialSendOtpBtn = document.getElementById('trialSendOtpBtn');
const trialResendOtpBtn = document.getElementById('trialResendOtpBtn');
const trialStep1 = document.getElementById('trialStep1');
const trialStep2 = document.getElementById('trialStep2');
const trialStep3 = document.getElementById('trialStep3');
const trialOtpSentEmail = document.getElementById('trialOtpSentEmail');
const trialOtpInput = document.getElementById('trialOtpInput');
const trialClaimBtn = document.getElementById('trialClaimBtn');
const trialCreditsMsg = document.getElementById('trialCreditsMsg');
const trialError = document.getElementById('trialError');
const cancelTrialBtn = document.getElementById('cancelTrialBtn');

const PREFS_STORAGE_KEY = 'ocr_magic_prefs_v1';
const GOOGLE_KEY_STORAGE_KEY = 'ocr_magic_google_key_enc_v1';
const GOOGLE_KEY_CONSENT_KEY = 'ocr_magic_google_key_cookie_consent_v1';
const GEMINI_KEY_STORAGE_KEY = 'ocr_magic_gemini_key_enc_v1';
const GEMINI_KEY_CONSENT_KEY = 'ocr_magic_gemini_key_cookie_consent_v1';
const OPENROUTER_KEY_STORAGE_KEY = 'ocr_magic_openrouter_key_enc_v1';
const OPENROUTER_KEY_CONSENT_KEY = 'ocr_magic_openrouter_key_cookie_consent_v1';
