// ── onboarding.js ── First-time user onboarding wizard + tutorial modal

const ONBOARDING_DONE_KEY = 'onlineocrfree_onboarding_done_v1';
const TUTORIAL_VIDEO_URL = 'https://www.youtube.com/embed/Upbo17KtXIE?si=T2ZeZfkqvfKtQfZ-';

// ── DOM References ──
const onboardingOverlay = document.getElementById('onboardingOverlay');
const onboardingThemeToggle = document.getElementById('onboardingThemeToggle');
const onboardingDropZone = document.getElementById('onboardingDropZone');
const onboardingBrowseBtn = document.getElementById('onboardingBrowseBtn');
const onboardingFileListEl = document.getElementById('onboardingFileList');
const onboardingUploadNext = document.getElementById('onboardingUploadNext');
const onboardingLanguageSelect = document.getElementById('onboardingLanguage');
const onboardingEngineSelect = document.getElementById('onboardingEngineSelect');
const onboardingSettingsNext = document.getElementById('onboardingSettingsNext');
const onboardingFinishBtn = document.getElementById('onboardingFinishBtn');
const onboardingDontShow = document.getElementById('onboardingDontShow');
const onboardingSummaryFiles = document.getElementById('onboardingSummaryFiles');
const onboardingSummaryLang = document.getElementById('onboardingSummaryLang');
const onboardingSummaryEngine = document.getElementById('onboardingSummaryEngine');
const onboardingTrialHint = document.getElementById('onboardingTrialHint');

const onboardingTutorialToggle = document.getElementById('onboardingTutorialToggle');
const onboardingTutorialWrap = document.getElementById('onboardingTutorialWrap');
const onboardingTutorialIframe = document.getElementById('onboardingTutorialIframe');

const tutorialBtn = document.getElementById('tutorialBtn');
const tutorialModal = document.getElementById('tutorialModal');
const tutorialVideo = document.getElementById('tutorialVideo');
const closeTutorialBtn = document.getElementById('closeTutorialBtn');

let onboardingCurrentStep = 0;
let onboardingSelectedEngine = 'tesseract';
let onboardingActive = false;

// ── Check if onboarding should show ──
const shouldShowOnboarding = () => {
    return !localStorage.getItem(ONBOARDING_DONE_KEY);
};

// ── Initialize onboarding ──
const initOnboarding = () => {
    setupTutorialListeners();

    if (!shouldShowOnboarding() || !onboardingOverlay) return;

    populateOnboardingLanguages();
    populateOnboardingEngines();
    syncOnboardingThemeIcon();
    onboardingOverlay.classList.remove('hidden');
    onboardingActive = true;
    setupOnboardingListeners();
};

// ── Populate language select from main dropdown ──
const populateOnboardingLanguages = () => {
    if (!languageSelect || !onboardingLanguageSelect) return;
    onboardingLanguageSelect.innerHTML = '';
    Array.from(languageSelect.options).forEach(opt => {
        const newOpt = document.createElement('option');
        newOpt.value = opt.value;
        newOpt.textContent = opt.textContent;
        if (opt.selected) newOpt.selected = true;
        onboardingLanguageSelect.appendChild(newOpt);
    });
};

// ── Populate engine dropdown from main select ──
const populateOnboardingEngines = () => {
    if (!ocrEngineSelect || !onboardingEngineSelect) return;
    // Keep the placeholder first option, add the rest from main select
    const placeholder = onboardingEngineSelect.options[0];
    onboardingEngineSelect.innerHTML = '';
    onboardingEngineSelect.appendChild(placeholder);
    Array.from(ocrEngineSelect.options).forEach(opt => {
        const newOpt = document.createElement('option');
        newOpt.value = opt.value;
        newOpt.textContent = opt.textContent;
        onboardingEngineSelect.appendChild(newOpt);
    });
};

// ── Sync onboarding theme icon with current state ──
const syncOnboardingThemeIcon = () => {
    if (!onboardingThemeToggle) return;
    const isDark = document.body.classList.contains('dark-mode');
    const icon = onboardingThemeToggle.querySelector('i');
    if (icon) icon.className = isDark ? 'fas fa-sun' : 'fas fa-moon';
};

// ── Tutorial Modal Listeners ──
const setupTutorialListeners = () => {
    if (tutorialBtn) {
        tutorialBtn.addEventListener('click', openTutorialModal);
    }
    if (closeTutorialBtn) {
        closeTutorialBtn.addEventListener('click', closeTutorialModal);
    }
    if (tutorialModal) {
        tutorialModal.addEventListener('click', (e) => {
            if (e.target === tutorialModal) closeTutorialModal();
        });
    }
};

const openTutorialModal = () => {
    if (!tutorialModal || !tutorialVideo) return;
    tutorialVideo.src = TUTORIAL_VIDEO_URL;
    tutorialModal.classList.remove('hidden');
};

const closeTutorialModal = () => {
    if (!tutorialModal || !tutorialVideo) return;
    tutorialVideo.src = '';
    tutorialModal.classList.add('hidden');
};

// ── Onboarding Event Listeners ──
const setupOnboardingListeners = () => {
    // Theme toggle
    if (onboardingThemeToggle) {
        onboardingThemeToggle.addEventListener('click', () => {
            toggleTheme();
            syncOnboardingThemeIcon();
        });
    }

    // Tutorial video toggle
    if (onboardingTutorialToggle) {
        onboardingTutorialToggle.addEventListener('click', () => {
            const isHidden = onboardingTutorialWrap.classList.contains('hidden');
            onboardingTutorialWrap.classList.toggle('hidden', !isHidden);
            onboardingTutorialToggle.classList.toggle('expanded', isHidden);
            if (isHidden && onboardingTutorialIframe) {
                onboardingTutorialIframe.src = TUTORIAL_VIDEO_URL;
            } else if (!isHidden && onboardingTutorialIframe) {
                onboardingTutorialIframe.src = '';
            }
        });
    }

    // Step 1: Upload
    if (onboardingBrowseBtn) {
        onboardingBrowseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            fileInput.click();
        });
    }

    if (onboardingDropZone) {
        onboardingDropZone.addEventListener('click', (e) => {
            if (e.target.closest('.onboarding-browse-btn')) return;
            fileInput.click();
        });

        onboardingDropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            onboardingDropZone.classList.add('drag-over');
        });

        onboardingDropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            onboardingDropZone.classList.remove('drag-over');
        });

        onboardingDropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            onboardingDropZone.classList.remove('drag-over');
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                handleFileSelect({ target: { files: e.dataTransfer.files } });
                updateOnboardingFileList();
            }
        });
    }

    fileInput.addEventListener('change', onboardingFileInputHandler);

    if (onboardingUploadNext) {
        onboardingUploadNext.addEventListener('click', () => goToOnboardingStep(1));
    }

    // Step 2: Engine cards
    document.querySelectorAll('.onboarding-engine-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.onboarding-engine-card').forEach(c =>
                c.classList.remove('active'));
            card.classList.add('active');
            onboardingSelectedEngine = card.dataset.engine;
            // Reset dropdown when a card is clicked
            if (onboardingEngineSelect) onboardingEngineSelect.value = '';
            updateOnboardingTrialHint();
        });
    });

    // Step 2: Engine dropdown (all models)
    if (onboardingEngineSelect) {
        onboardingEngineSelect.addEventListener('change', () => {
            const val = onboardingEngineSelect.value;
            if (!val) return; // placeholder selected, ignore
            onboardingSelectedEngine = val;
            // Deselect cards if dropdown picks something not matching a card
            document.querySelectorAll('.onboarding-engine-card').forEach(c => {
                if (c.dataset.engine === val) {
                    c.classList.add('active');
                } else {
                    c.classList.remove('active');
                }
            });
            updateOnboardingTrialHint();
        });
    }

    if (onboardingSettingsNext) {
        onboardingSettingsNext.addEventListener('click', () => {
            applyOnboardingSettings();
            goToOnboardingStep(2);
        });
    }

    // Step 3: Finish
    if (onboardingFinishBtn) {
        onboardingFinishBtn.addEventListener('click', finishOnboarding);
    }

    // Back buttons
    document.querySelectorAll('.onboarding-btn-back').forEach(btn => {
        btn.addEventListener('click', () => {
            const target = parseInt(btn.dataset.goto, 10);
            goToOnboardingStep(target);
        });
    });
};

// ── Update trial hint visibility ──
const updateOnboardingTrialHint = () => {
    if (onboardingTrialHint) {
        onboardingTrialHint.classList.toggle('hidden',
            onboardingSelectedEngine !== 'google-vision');
    }
};

// ── File input handler for onboarding ──
const onboardingFileInputHandler = () => {
    if (onboardingActive) {
        // Small delay to ensure handleFileSelect has processed files into filesData
        setTimeout(updateOnboardingFileList, 50);
    }
};

// ── Update file list display ──
const updateOnboardingFileList = () => {
    if (!onboardingFileListEl || !onboardingUploadNext) return;

    if (filesData.length === 0) {
        onboardingFileListEl.classList.add('hidden');
        onboardingUploadNext.disabled = true;
        return;
    }

    onboardingFileListEl.classList.remove('hidden');
    onboardingUploadNext.disabled = false;

    onboardingFileListEl.innerHTML = filesData.map(f => `
        <div class="onboarding-file-item">
            <i class="fas ${f.type === 'pdf' ? 'fa-file-pdf' : 'fa-file-image'}"></i>
            <span>${f.name}</span>
        </div>
    `).join('');
};

// ── Apply settings to dashboard controls ──
const applyOnboardingSettings = () => {
    if (onboardingLanguageSelect && languageSelect) {
        languageSelect.value = onboardingLanguageSelect.value;
    }
    if (ocrEngineSelect) {
        ocrEngineSelect.value = onboardingSelectedEngine;
    }
    saveUserPreferences();
    updateEngineUI();
};

// ── Step Navigation ──
const goToOnboardingStep = (step) => {
    const panels = document.querySelectorAll('.onboarding-panel');
    const steps = document.querySelectorAll('.stepper-step');
    const lines = document.querySelectorAll('.stepper-line');

    // Animate out current panel
    const currentPanel = document.querySelector(`.onboarding-panel[data-panel="${onboardingCurrentStep}"]`);
    if (currentPanel) {
        currentPanel.classList.add('leaving');
        setTimeout(() => {
            currentPanel.classList.add('hidden');
            currentPanel.classList.remove('leaving');
        }, 200);
    }

    // Animate in new panel
    const nextPanel = document.querySelector(`.onboarding-panel[data-panel="${step}"]`);
    if (nextPanel) {
        setTimeout(() => {
            nextPanel.classList.remove('hidden');
            nextPanel.classList.add('entering');
            setTimeout(() => nextPanel.classList.remove('entering'), 250);
        }, 210);
    }

    // Update stepper circles
    steps.forEach((s, i) => {
        s.classList.remove('active', 'completed');
        if (i < step) s.classList.add('completed');
        else if (i === step) s.classList.add('active');
    });

    // Update connecting lines
    lines.forEach((line, i) => {
        line.classList.toggle('completed', i < step);
    });

    // Update summary on final step
    if (step === 2) {
        updateOnboardingSummary();
    }

    onboardingCurrentStep = step;
};

// ── Summary for final step ──
const updateOnboardingSummary = () => {
    const count = filesData.length;
    if (onboardingSummaryFiles) {
        onboardingSummaryFiles.textContent = count === 1 ? '1 file' : `${count} files`;
    }
    if (onboardingSummaryLang && onboardingLanguageSelect) {
        const opt = onboardingLanguageSelect.selectedOptions[0];
        onboardingSummaryLang.textContent = opt ? opt.textContent : 'English';
    }
    if (onboardingSummaryEngine && ocrEngineSelect) {
        // Look up the display name from the main engine select
        const engineOpt = Array.from(ocrEngineSelect.options).find(o => o.value === onboardingSelectedEngine);
        onboardingSummaryEngine.textContent = engineOpt ? engineOpt.textContent : onboardingSelectedEngine;
    }
};

// ── Finish onboarding ──
const finishOnboarding = () => {
    if (onboardingDontShow && onboardingDontShow.checked) {
        localStorage.setItem(ONBOARDING_DONE_KEY, 'true');
    }

    onboardingActive = false;
    fileInput.removeEventListener('change', onboardingFileInputHandler);

    // Stop tutorial video if playing
    if (onboardingTutorialIframe) onboardingTutorialIframe.src = '';

    // Fade out overlay
    onboardingOverlay.style.opacity = '0';
    setTimeout(() => {
        onboardingOverlay.classList.add('hidden');
        onboardingOverlay.style.opacity = '';
    }, 300);

    // Refresh dashboard state
    updateEngineUI();
    updateGlobalButtons();
    renderFileList();
    if (filesData.length > 0 && !activeFileId) {
        selectFile(filesData[0].id);
    }
};
