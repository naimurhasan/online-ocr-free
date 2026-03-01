// ── main.js ── Entry point (loaded last, after all other scripts)

const init = async () => {
    initTheme();
    setupEventListeners();
    initOnboarding();
    await fetchServerConfig();
    await loadUserPreferences();
    updateEngineUI();
    updateOverallProgressUI();
    updateGlobalButtons();
    checkActiveJob();
};

const setupEventListeners = () => {
    try { _setupEventListeners(); } catch (e) { console.error('setupEventListeners FAILED:', e); }
};

const _setupEventListeners = () => {
    if (addFilesBtn) {
        addFilesBtn.addEventListener('click', () => fileInput.click());
    }
    fileInput.addEventListener('change', handleFileSelect);

    fileList.addEventListener('click', (e) => {
        const removeBtn = e.target.closest('.remove-file-btn');
        if (removeBtn) {
            e.preventDefault();
            e.stopPropagation();
            const { fileId } = removeBtn.dataset;
            if (fileId) removeFile(fileId);
            return;
        }

        const settingsBtn = e.target.closest('.settings-file-btn');
        if (settingsBtn) {
            e.preventDefault();
            e.stopPropagation();
            const { fileId } = settingsBtn.dataset;
            if (fileId) openSettings(fileId);
            return;
        }

        const addMoreItem = e.target.closest('.add-more-item');
        if (addMoreItem) {
            if (!batchProgress.running) fileInput.click();
            return;
        }

        const fileItem = e.target.closest('.file-item[data-file-id]');
        if (fileItem) {
            const { fileId } = fileItem.dataset;
            if (fileId) selectFile(fileId);
            return;
        }

        if (e.target.closest('.empty-state') && !batchProgress.running) {
            fileInput.click();
        }
    });

    fileList.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
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
            fileInput.files = e.dataTransfer.files;
            handleFileSelect({ target: { files: e.dataTransfer.files } });
        }
    });

    if (clearAllBtn) clearAllBtn.addEventListener('click', clearAll);
    if (downloadAllBtn) downloadAllBtn.addEventListener('click', openExportModal);

    if (processBtn) processBtn.addEventListener('click', handleProcessClick);
    if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);
    if (outputText) outputText.addEventListener('input', syncTextEditToState);
    if (cancelReviewBtn) cancelReviewBtn.addEventListener('click', closeReviewModal);
    if (confirmReviewBtn) confirmReviewBtn.addEventListener('click', startBatchProcessing);
    if (cancelExportBtn) cancelExportBtn.addEventListener('click', closeExportModal);
    if (exportCombinedBtn) exportCombinedBtn.addEventListener('click', downloadCombinedTxt);
    if (exportZipBtn) exportZipBtn.addEventListener('click', downloadAllZip);
    if (exportPdfBtn) exportPdfBtn.addEventListener('click', downloadPdf);
    if (emailProcessBtn) emailProcessBtn.addEventListener('click', openEmailOtpModalSafe);
    if (emailFormatZipBtn) emailFormatZipBtn.addEventListener('click', () => setEmailFormat('zip'));
    if (emailFormatPdfBtn) emailFormatPdfBtn.addEventListener('click', () => setEmailFormat('pdf'));
    if (sendOtpBtn) sendOtpBtn.addEventListener('click', handleSendOtp);
    if (verifyAndSendBtn) verifyAndSendBtn.addEventListener('click', handleVerifyAndSubmitJob);
    if (resendOtpBtn) resendOtpBtn.addEventListener('click', handleSendOtp);
    if (cancelEmailBtn) cancelEmailBtn.addEventListener('click', closeEmailOtpModal);
    if (appAlertCancelBtn) appAlertCancelBtn.addEventListener('click', () => resolveAppAlert(false));
    if (appAlertConfirmBtn) appAlertConfirmBtn.addEventListener('click', () => resolveAppAlert(true));
    if (appAlertModal) appAlertModal.addEventListener('click', (e) => {
        if (e.target === appAlertModal && appAlertCancelBtn && !appAlertCancelBtn.classList.contains('hidden')) {
            resolveAppAlert(false);
        }
    });

    if (advancedSettingsBtn) {
        advancedSettingsBtn.addEventListener('click', openAdvancedSettings);
    }
    if (cancelAdvSettingsBtn) {
        cancelAdvSettingsBtn.addEventListener('click', closeAdvancedSettings);
    }
    if (saveAdvSettingsBtn) {
        saveAdvSettingsBtn.addEventListener('click', saveAdvancedSettings);
    }
    if (resetAllSettingsBtn) {
        resetAllSettingsBtn.addEventListener('click', resetAllSettings);
    }
    if (useTranslationPromptBtn) {
        useTranslationPromptBtn.addEventListener('click', handleUseTranslationPrompt);
    }
    if (concurrentThreadsSlider) {
        concurrentThreadsSlider.addEventListener('input', () => {
            concurrentThreadsValue.textContent = concurrentThreadsSlider.value;
        });
    }
    if (toggleDefaultPromptBtn) {
        toggleDefaultPromptBtn.addEventListener('click', () => {
            const isHidden = defaultPromptDisplay.classList.contains('hidden');
            const isMarkdown = openRouterOutputFormatSelect?.value === 'markdown';
            const formatLabel = isMarkdown ? 'markdown' : 'plain text';
            if (isHidden) {
                const activePrompt = isMarkdown ? serverDefaultPromptMarkdown : serverDefaultPromptPlain;
                defaultPromptDisplay.textContent = activePrompt || '(Could not load default prompt from server)';
            }
            defaultPromptDisplay.classList.toggle('hidden', !isHidden);
            if (copyDefaultPromptBtn) copyDefaultPromptBtn.classList.toggle('hidden', !isHidden);
            toggleDefaultPromptBtn.classList.toggle('expanded', isHidden);
            toggleDefaultPromptBtn.innerHTML = isHidden
                ? `<i class="fas fa-chevron-right"></i> Hide default prompt (${formatLabel})`
                : `<i class="fas fa-chevron-right"></i> Show default prompt (${formatLabel})`;
        });
    }
    if (copyDefaultPromptBtn) {
        copyDefaultPromptBtn.addEventListener('click', () => {
            const text = defaultPromptDisplay.textContent;
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                showToast('Default prompt copied!');
            });
        });
    }
    if (advancedSettingsModal) {
        advancedSettingsModal.addEventListener('click', (e) => {
            if (e.target === advancedSettingsModal) closeAdvancedSettings();
        });
    }

    if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
    if (languageSelect) languageSelect.addEventListener('change', saveUserPreferences);
    if (ocrEngineSelect) ocrEngineSelect.addEventListener('change', async () => {
        if (isGoogleVisionSelected()) {
            await ensureGoogleKeyStorageConsent();
        }
        if (isGeminiSelected()) {
            await ensureGeminiKeyStorageConsent();
        }
        if (isOpenRouterSelected()) {
            await ensureOpenRouterKeyStorageConsent();
        }
        saveUserPreferences();
        updateEngineUI();
        updateGlobalButtons();
    });
    if (openRouterOutputFormatSelect) openRouterOutputFormatSelect.addEventListener('change', saveUserPreferences);
    if (googleVisionApiKeyInput) googleVisionApiKeyInput.addEventListener('input', async () => {
        await persistGoogleKeyIfAllowed();
        updateGlobalButtons();
    });
    if (geminiApiKeyInput) {
        geminiApiKeyInput.addEventListener('input', async () => {
            await persistGeminiKeyIfAllowed();
            updateGlobalButtons();
        });
    }
    if (openRouterApiKeyInput) openRouterApiKeyInput.addEventListener('input', async () => {
        await persistOpenRouterKeyIfAllowed();
        updateGlobalButtons();
    });
    if (openRouterCustomModelInput) {
        openRouterCustomModelInput.addEventListener('input', () => {
            saveUserPreferences();
            updateGlobalButtons();
        });
    }
    if (geminiCustomModelInput) {
        geminiCustomModelInput.addEventListener('input', () => {
            saveUserPreferences();
            updateGlobalButtons();
        });
    }

    if (getTrialKeyBtn) getTrialKeyBtn.addEventListener('click', openTrialModal);
    if (cancelTrialBtn) cancelTrialBtn.addEventListener('click', closeTrialModal);
    if (trialSendOtpBtn) trialSendOtpBtn.addEventListener('click', handleTrialSendOtp);
    if (trialResendOtpBtn) trialResendOtpBtn.addEventListener('click', handleTrialSendOtp);
    if (trialClaimBtn) trialClaimBtn.addEventListener('click', handleTrialClaim);
    if (trialModal) trialModal.addEventListener('click', (e) => { if (e.target === trialModal) closeTrialModal(); });

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

    document.getElementById('prevPageBtn').addEventListener('click', () => navigatePage(-1));
    document.getElementById('nextPageBtn').addEventListener('click', () => navigatePage(1));

    cancelSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);
    rotationPoints.forEach((point) => {
        point.addEventListener('click', () => {
            const rotation = parseInt(point.dataset.rotation, 10) || 0;
            setSettingsRotation(rotation);
        });
    });

    if (selectColumnsBtn) selectColumnsBtn.addEventListener('click', () => {
        if (!activeFileId) return;
        columnsModal.classList.remove('hidden');
    });

    if (cancelColumnsBtn) cancelColumnsBtn.addEventListener('click', () => {
        columnsModal.classList.add('hidden');
    });

    columnOptions.forEach(btn => {
        btn.addEventListener('click', async () => {
            const cols = parseInt(btn.dataset.cols, 10);
            columnsModal.classList.add('hidden');

            const file = filesData.find(f => f.id === activeFileId);
            if (cols > 1 && file && file.type === 'pdf' && file.pages.length === 0) {
                const targetPage = file.activeViewerPage || 1;
                const oldUrl = file.previewUrl;
                await generatePdfThumbnail(file, targetPage);
                if (oldUrl && oldUrl !== 'https://placehold.co/50x70?text=PDF') {
                    URL.revokeObjectURL(oldUrl);
                }
            }

            setupColumns(cols);
        });
    });

    confirmSplitBtn.addEventListener('click', async () => {
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

        columnsModal.classList.add('hidden');

        const splitters = document.querySelectorAll('.column-splitter');
        splitters.forEach(s => s.style.pointerEvents = 'none');

        updateColumnsButtonUI();
        updateGlobalButtons();
        recenterPreviewView();
    });

    if (previewContainer) previewContainer.addEventListener('wheel', handleZoomWheel, { passive: false });
    if (previewContainer) previewContainer.addEventListener('mousedown', handlePanStart);
    document.addEventListener('mousemove', handlePanMove);
    document.addEventListener('mouseup', handlePanEnd);
};

const handleProcessClick = () => {
    if (batchProgress.running || filesData.length === 0) return;

    if (globalColumnsConfigs.numColumns > 1 && !globalColumnsConfigs.active) return;
    if (isGoogleVisionSelected() && !getGoogleVisionApiKey()) {
        showAppAlert('Please enter your Google Vision API key first.', { title: 'Google Vision API Key' });
        return;
    }
    if (isGeminiSelected() && !getGeminiApiKey()) {
        showAppAlert('Please enter your Gemini API key first.', { title: 'Gemini API Key' });
        return;
    }
    if (isOpenRouterSelected() && !getOpenRouterApiKey()) {
        showAppAlert('Please enter your OpenRouter API key first.', { title: 'OpenRouter API Key' });
        return;
    }
    if (isGeminiCustomSelected() && (!geminiCustomModelInput || !geminiCustomModelInput.value.trim())) {
        showAppAlert('Please enter a Gemini model ID (e.g. gemini-1.5-pro).', { title: 'Missing Gemini Model' });
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

    const threads = Math.max(1, Math.min(advancedSettings.concurrentThreads, serverMaxThreads));
    if (reviewConcurrencyRow && reviewConcurrency) {
        if (threads > 1) {
            reviewConcurrency.textContent = String(threads);
            reviewConcurrencyRow.classList.remove('hidden');
        } else {
            reviewConcurrencyRow.classList.add('hidden');
        }
    }

    const promptRow = document.getElementById('reviewCustomPromptRow');
    if (promptRow) promptRow.classList.toggle('hidden', !advancedSettings.customPrompt);

    const tesseractNote = document.getElementById('tesseractNote');
    if (tesseractNote) tesseractNote.classList.toggle('hidden', ocrEngineSelect.value !== 'tesseract');

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

document.addEventListener('DOMContentLoaded', init);
