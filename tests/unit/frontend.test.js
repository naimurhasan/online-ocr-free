/**
 * Frontend unit tests
 * Tests the pure logic functions from the frontend JS files
 * Uses jsdom environment to simulate browser APIs
 *
 * @jest-environment jsdom
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

// We'll store all frontend globals in this object
const G = {};

const loadScriptIntoContext = (filePath, ctx) => {
    const code = fs.readFileSync(path.resolve(filePath), 'utf-8');
    // Replace const/let at the start of a line with var so they become context properties
    const patched = code.replace(/^(const|let) /gm, 'var ');
    vm.runInContext(patched, ctx, { filename: filePath });
};

beforeAll(() => {
    const elementIds = [
        'fileInput', 'selectColumnsBtn', 'confirmSplitBtn', 'columnsModal',
        'cancelColumnsBtn', 'columnPdfPageControl', 'columnPdfPageNum',
        'settingsModal', 'settingsModalTitle', 'settingsFileName',
        'pdfPageSettings', 'pdfPageHint', 'startPage', 'endPage',
        'cancelSettingsBtn', 'saveSettingsBtn', 'rotationHand',
        'addFilesBtn', 'downloadAllBtn', 'clearAllBtn', 'fileList',
        'previewContainer', 'previewName', 'outputText', 'processBtn',
        'copyBtn', 'themeToggle', 'language', 'languageWrap', 'ocrEngine',
        'googleVisionKeyWrap', 'googleVisionApiKey', 'openRouterKeyWrap',
        'openRouterApiKey', 'openRouterFormatWrap', 'openRouterOutputFormat',
        'openRouterCustomModelWrap', 'openRouterCustomModel',
        'fileCount', 'reviewModal', 'cancelReviewBtn', 'confirmReviewBtn',
        'reviewLanguage', 'reviewColumns', 'reviewSelectionCount',
        'reviewEngine', 'reviewConcurrencyRow', 'reviewConcurrency',
        'exportModal', 'cancelExportBtn', 'exportCombinedBtn', 'exportZipBtn',
        'emailProcessBtn', 'emailOtpModal', 'emailInput', 'sendOtpBtn',
        'emailStep1', 'emailStep2', 'otpSentEmail', 'otpInput',
        'verifyAndSendBtn', 'resendOtpBtn', 'emailError', 'cancelEmailBtn',
        'appAlertModal', 'appAlertTitle', 'appAlertMessage',
        'appAlertCancelBtn', 'appAlertConfirmBtn',
        'overallProgress', 'overallProgressText', 'overallEtaText',
        'overallProgressFill', 'overallProgressCurrent',
        'advancedSettingsBtn', 'advancedSettingsModal',
        'cancelAdvSettingsBtn', 'saveAdvSettingsBtn', 'resetAllSettingsBtn',
        'concurrentThreadsSlider', 'concurrentThreadsValue',
        'preprocessingToggle', 'customPromptInput',
        'toggleDefaultPromptBtn', 'defaultPromptDisplay', 'promptInfoIcon'
    ];

    elementIds.forEach(id => {
        const el = document.createElement('div');
        el.id = id;
        el.innerHTML = '<i class="fas fa-moon"></i>';
        document.body.appendChild(el);
    });

    const opt1 = document.createElement('div');
    opt1.classList.add('column-option');
    document.body.appendChild(opt1);
    const rp1 = document.createElement('div');
    rp1.classList.add('rotation-point');
    document.body.appendChild(rp1);

    // Mock matchMedia on the real jsdom window (theme.js uses window.matchMedia)
    Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: jest.fn().mockImplementation(query => ({
            matches: false,
            media: query,
            onchange: null,
            addListener: jest.fn(),
            removeListener: jest.fn(),
            addEventListener: jest.fn(),
            removeEventListener: jest.fn(),
            dispatchEvent: jest.fn(),
        })),
    });

    // Build sandbox context sharing jsdom DOM globals
    const sandbox = {
        document,
        window,
        localStorage,
        console,
        matchMedia: (q) => ({ matches: false, addListener: () => {}, removeListener: () => {} }),
        btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
        atob: (s) => Buffer.from(s, 'base64').toString('binary'),
        unescape,
        escape,
        encodeURIComponent,
        decodeURIComponent,
        Math, parseInt, JSON, Array, Set, Object, String, Number, Boolean, Error,
        Promise, setTimeout, clearTimeout, Map, RegExp, Infinity, NaN, undefined,
        isNaN, isFinite, parseFloat,
        showToast: jest.fn(),
        showAppConfirm: jest.fn().mockResolvedValue(true),
        updateGlobalButtons: jest.fn(),
    };

    const ctx = vm.createContext(sandbox);

    // Load scripts into the shared context (with const/let → var)
    loadScriptIntoContext('public/js/state.js', ctx);
    loadScriptIntoContext('public/js/theme.js', ctx);
    loadScriptIntoContext('public/js/settings.js', ctx);

    // Store the context so tests can access all vars
    G.ctx = ctx;
});

describe('state.js - cloneColumnsConfig', () => {
    test('creates a deep copy', () => {
        const original = { active: true, numColumns: 3, splitPositions: [0.33, 0.66] };
        const cloned = G.ctx.cloneColumnsConfig(original);

        expect(cloned).toEqual(original);
        expect(cloned).not.toBe(original);
        expect(cloned.splitPositions).not.toBe(original.splitPositions);
    });

    test('handles null/undefined config', () => {
        expect(G.ctx.cloneColumnsConfig(null)).toEqual({ active: false, numColumns: 1, splitPositions: [] });
        expect(G.ctx.cloneColumnsConfig(undefined)).toEqual({ active: false, numColumns: 1, splitPositions: [] });
    });

    test('defaults numColumns to 1', () => {
        const result = G.ctx.cloneColumnsConfig({ active: false });
        expect(result.numColumns).toBe(1);
    });
});

describe('state.js - getFileColumnsConfig', () => {
    test('returns file config if present', () => {
        const file = { columnConfig: { active: true, numColumns: 2, splitPositions: [0.5] } };
        const config = G.ctx.getFileColumnsConfig(file);
        expect(config.active).toBe(true);
        expect(config.numColumns).toBe(2);
    });

    test('returns default for null file', () => {
        const config = G.ctx.getFileColumnsConfig(null);
        expect(config).toEqual({ active: false, numColumns: 1, splitPositions: [] });
    });
});

describe('state.js - syncColumnsToFile / syncColumnsFromFile', () => {
    test('syncColumnsToFile sets file columnConfig', () => {
        const file = {};
        G.ctx.globalColumnsConfigs = { active: true, numColumns: 3, splitPositions: [0.33, 0.66] };
        G.ctx.syncColumnsToFile(file);
        expect(file.columnConfig).toEqual({ active: true, numColumns: 3, splitPositions: [0.33, 0.66] });
    });

    test('syncColumnsToFile does nothing for null file', () => {
        expect(() => G.ctx.syncColumnsToFile(null)).not.toThrow();
    });

    test('syncColumnsFromFile updates global config', () => {
        const file = { columnConfig: { active: true, numColumns: 2, splitPositions: [0.5] } };
        G.ctx.syncColumnsFromFile(file);
        expect(G.ctx.globalColumnsConfigs.active).toBe(true);
        expect(G.ctx.globalColumnsConfigs.numColumns).toBe(2);
    });
});

describe('state.js - initial state values', () => {
    test('filesData starts as array', () => {
        expect(Array.isArray(G.ctx.filesData)).toBe(true);
    });

    test('activeFileId starts null', () => {
        expect(G.ctx.activeFileId).toBeNull();
    });

    test('zoomLevel starts at 1', () => {
        expect(G.ctx.zoomLevel).toBe(1);
    });

    test('batchProgress starts not running', () => {
        expect(G.ctx.batchProgress.running).toBe(false);
        expect(G.ctx.batchProgress.totalFiles).toBe(0);
    });

    test('storage keys are defined', () => {
        expect(G.ctx.PREFS_STORAGE_KEY).toBe('ocr_magic_prefs_v1');
        expect(G.ctx.GOOGLE_KEY_STORAGE_KEY).toBe('ocr_magic_google_key_enc_v1');
        expect(G.ctx.OPENROUTER_KEY_STORAGE_KEY).toBe('ocr_magic_openrouter_key_enc_v1');
    });
});

describe('theme.js', () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.classList.remove('dark-mode');
    });

    test('initTheme applies dark mode from localStorage', () => {
        localStorage.setItem('theme', 'dark');
        G.ctx.initTheme();
        expect(document.body.classList.contains('dark-mode')).toBe(true);
    });

    test('initTheme does not apply dark mode for light theme', () => {
        localStorage.setItem('theme', 'light');
        G.ctx.initTheme();
        expect(document.body.classList.contains('dark-mode')).toBe(false);
    });

    test('toggleTheme switches dark mode on', () => {
        G.ctx.toggleTheme();
        expect(document.body.classList.contains('dark-mode')).toBe(true);
        expect(localStorage.getItem('theme')).toBe('dark');
    });

    test('toggleTheme switches dark mode off', () => {
        document.body.classList.add('dark-mode');
        G.ctx.toggleTheme();
        expect(document.body.classList.contains('dark-mode')).toBe(false);
        expect(localStorage.getItem('theme')).toBe('light');
    });

    test('updateThemeIcon sets sun icon for dark mode', () => {
        G.ctx.updateThemeIcon(true);
        const icon = document.getElementById('themeToggle').querySelector('i');
        expect(icon.className).toBe('fas fa-sun');
    });

    test('updateThemeIcon sets moon icon for light mode', () => {
        G.ctx.updateThemeIcon(false);
        const icon = document.getElementById('themeToggle').querySelector('i');
        expect(icon.className).toBe('fas fa-moon');
    });
});

describe('settings.js - encode/decode', () => {
    test('encodeForStorage encodes string to base64', () => {
        const encoded = G.ctx.encodeForStorage('hello');
        expect(typeof encoded).toBe('string');
        expect(encoded).not.toBe('hello');
    });

    test('decodeFromStorage decodes back to original', () => {
        const encoded = G.ctx.encodeForStorage('test-api-key-123');
        const decoded = G.ctx.decodeFromStorage(encoded);
        expect(decoded).toBe('test-api-key-123');
    });

    test('decodeFromStorage returns empty string for null/undefined', () => {
        expect(G.ctx.decodeFromStorage(null)).toBe('');
        expect(G.ctx.decodeFromStorage(undefined)).toBe('');
    });

    test('encode/decode handles unicode (Bengali) text', () => {
        const encoded = G.ctx.encodeForStorage('বাংলা');
        const decoded = G.ctx.decodeFromStorage(encoded);
        expect(decoded).toBe('বাংলা');
    });
});

describe('settings.js - engine selection helpers', () => {
    test('isGoogleVisionSelected returns true when google-vision', () => {
        document.getElementById('ocrEngine').value = 'google-vision';
        expect(G.ctx.isGoogleVisionSelected()).toBe(true);
    });

    test('isGoogleVisionSelected returns false for tesseract', () => {
        document.getElementById('ocrEngine').value = 'tesseract';
        expect(G.ctx.isGoogleVisionSelected()).toBe(false);
    });

    test('isOpenRouterSelected returns true for all OpenRouter engines', () => {
        ['gemma-openrouter-free', 'gemma-openrouter-paid', 'mistral-openrouter-free', 'mistral-openrouter-paid', 'openrouter-custom'].forEach(engine => {
            document.getElementById('ocrEngine').value = engine;
            expect(G.ctx.isOpenRouterSelected()).toBe(true);
        });
    });

    test('isOpenRouterSelected returns false for non-OpenRouter engines', () => {
        document.getElementById('ocrEngine').value = 'tesseract';
        expect(G.ctx.isOpenRouterSelected()).toBe(false);
    });

    test('isOpenRouterCustomSelected returns true only for openrouter-custom', () => {
        document.getElementById('ocrEngine').value = 'openrouter-custom';
        expect(G.ctx.isOpenRouterCustomSelected()).toBe(true);

        document.getElementById('ocrEngine').value = 'gemma-openrouter-free';
        expect(G.ctx.isOpenRouterCustomSelected()).toBe(false);
    });
});

describe('settings.js - preferences persistence', () => {
    beforeEach(() => localStorage.clear());

    test('saveUserPreferences stores prefs in localStorage', () => {
        document.getElementById('language').value = 'ben';
        document.getElementById('ocrEngine').value = 'tesseract';

        G.ctx.saveUserPreferences();

        const stored = JSON.parse(localStorage.getItem(G.ctx.PREFS_STORAGE_KEY));
        expect(stored.language).toBe('ben');
        expect(stored.engine).toBe('tesseract');
    });

    test('saveAdvancedSettingsToStorage stores advanced settings', () => {
        G.ctx.advancedSettings.concurrentThreads = 3;
        G.ctx.advancedSettings.customPrompt = 'My prompt';
        G.ctx.advancedSettings.skipPreprocessing = true;

        G.ctx.saveAdvancedSettingsToStorage();

        const stored = JSON.parse(localStorage.getItem(G.ctx.ADVANCED_SETTINGS_KEY));
        expect(stored.concurrentThreads).toBe(3);
        expect(stored.customPrompt).toBe('My prompt');
        expect(stored.skipPreprocessing).toBe(true);
    });

    test('loadAdvancedSettingsFromStorage loads settings', () => {
        localStorage.setItem(G.ctx.ADVANCED_SETTINGS_KEY, JSON.stringify({
            concurrentThreads: 2, customPrompt: 'test', skipPreprocessing: true
        }));

        G.ctx.loadAdvancedSettingsFromStorage();

        expect(G.ctx.advancedSettings.concurrentThreads).toBe(2);
        expect(G.ctx.advancedSettings.customPrompt).toBe('test');
        expect(G.ctx.advancedSettings.skipPreprocessing).toBe(true);
    });

    test('loadAdvancedSettingsFromStorage handles corrupt data', () => {
        localStorage.setItem(G.ctx.ADVANCED_SETTINGS_KEY, 'not json');
        expect(() => G.ctx.loadAdvancedSettingsFromStorage()).not.toThrow();
    });

    test('loadAdvancedSettingsFromStorage clamps thread count to max', () => {
        G.ctx.serverMaxThreads = 4;
        localStorage.setItem(G.ctx.ADVANCED_SETTINGS_KEY, JSON.stringify({
            concurrentThreads: 100, customPrompt: '', skipPreprocessing: false
        }));

        G.ctx.loadAdvancedSettingsFromStorage();
        expect(G.ctx.advancedSettings.concurrentThreads).toBe(4);
    });
});

describe('settings.js - updateEngineUI', () => {
    test('shows google vision key field when google-vision selected', () => {
        document.getElementById('ocrEngine').value = 'google-vision';
        G.ctx.updateEngineUI();
        expect(document.getElementById('googleVisionKeyWrap').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('openRouterKeyWrap').classList.contains('hidden')).toBe(true);
    });

    test('shows openrouter fields when openrouter engine selected', () => {
        document.getElementById('ocrEngine').value = 'gemma-openrouter-free';
        G.ctx.updateEngineUI();
        expect(document.getElementById('googleVisionKeyWrap').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('openRouterKeyWrap').classList.contains('hidden')).toBe(false);
        expect(document.getElementById('openRouterFormatWrap').classList.contains('hidden')).toBe(false);
    });

    test('hides all extra fields for tesseract', () => {
        document.getElementById('ocrEngine').value = 'tesseract';
        G.ctx.updateEngineUI();
        expect(document.getElementById('googleVisionKeyWrap').classList.contains('hidden')).toBe(true);
        expect(document.getElementById('openRouterKeyWrap').classList.contains('hidden')).toBe(true);
    });

    test('shows custom model field for openrouter-custom', () => {
        document.getElementById('ocrEngine').value = 'openrouter-custom';
        G.ctx.updateEngineUI();
        expect(document.getElementById('openRouterCustomModelWrap').classList.contains('hidden')).toBe(false);
    });
});
