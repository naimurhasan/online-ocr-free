// ── emailFlow.js ── Email OTP modal, job submission, polling (depends on state.js, ocrProcessor.js)

const setEmailBtnLoading = (btn, loading) => {
    const text = btn.querySelector('.btn-text');
    const spinner = btn.querySelector('.btn-spinner');
    if (loading) {
        text.classList.add('hidden');
        spinner.classList.remove('hidden');
        btn.disabled = true;
    } else {
        text.classList.remove('hidden');
        spinner.classList.add('hidden');
        btn.disabled = false;
    }
};

const showEmailError = (msg) => {
    emailError.textContent = msg;
    emailError.classList.remove('hidden');
};

const hideEmailError = () => {
    emailError.textContent = '';
    emailError.classList.add('hidden');
};

let emailOutputFormat = 'zip';

const setEmailFormat = (format) => {
    emailOutputFormat = format;
    if (emailFormatZipBtn && emailFormatPdfBtn) {
        emailFormatZipBtn.classList.toggle('active', format === 'zip');
        emailFormatPdfBtn.classList.toggle('active', format === 'pdf');
    }
};

const openEmailOtpModal = () => {
    closeReviewModal();
    hideEmailError();
    emailStep1.classList.remove('hidden');
    emailStep2.classList.add('hidden');
    otpInput.value = '';
    setEmailFormat('zip');
    const savedEmail = sessionStorage.getItem('ocr_email');
    if (savedEmail) emailInput.value = savedEmail;
    emailOtpModal.classList.remove('hidden');
};

const closeEmailOtpModal = () => {
    emailOtpModal.classList.add('hidden');
    setEmailBtnLoading(sendOtpBtn, false);
    setEmailBtnLoading(verifyAndSendBtn, false);
    clearResendCooldown();
};

let resendCooldownTimer = null;
const startResendCooldown = (seconds) => {
    resendOtpBtn.disabled = true;
    let remaining = seconds;
    const tick = () => {
        resendOtpBtn.textContent = `Resend Code (${remaining}s)`;
        if (remaining <= 0) {
            clearResendCooldown();
            return;
        }
        remaining--;
        resendCooldownTimer = setTimeout(tick, 1000);
    };
    tick();
};

const clearResendCooldown = () => {
    if (resendCooldownTimer) {
        clearTimeout(resendCooldownTimer);
        resendCooldownTimer = null;
    }
    resendOtpBtn.disabled = false;
    resendOtpBtn.textContent = 'Resend Code';
};

const handleSendOtp = async () => {
    hideEmailError();
    const email = emailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showEmailError('Please enter a valid email address.');
        return;
    }

    setEmailBtnLoading(sendOtpBtn, true);
    resendOtpBtn.disabled = true;

    try {
        const resp = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await resp.json();

        if (!resp.ok) {
            showEmailError(data.error || 'Failed to send code.');
            setEmailBtnLoading(sendOtpBtn, false);
            resendOtpBtn.disabled = false;
            return;
        }

        sessionStorage.setItem('ocr_email', email);
        otpSentEmail.textContent = email;
        emailStep1.classList.add('hidden');
        emailStep2.classList.remove('hidden');
        otpInput.value = '';
        otpInput.focus();
        startResendCooldown(60);
    } catch {
        showEmailError('Network error. Please try again.');
        resendOtpBtn.disabled = false;
    } finally {
        setEmailBtnLoading(sendOtpBtn, false);
    }
};

const handleVerifyAndSubmitJob = async () => {
    hideEmailError();
    const email = emailInput.value.trim();
    const otp = otpInput.value.trim();

    if (!otp || otp.length !== 6) {
        showEmailError('Please enter the 6-digit code.');
        return;
    }

    if (filesData.length === 0) {
        showEmailError('No files to process.');
        return;
    }

    setEmailBtnLoading(verifyAndSendBtn, true);

    try {
        const verifyResp = await fetch('/api/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        });
        const verifyData = await verifyResp.json();

        if (!verifyResp.ok) {
            showEmailError(verifyData.error || 'Invalid or expired code.');
            setEmailBtnLoading(verifyAndSendBtn, false);
            return;
        }

        const formData = new FormData();
        formData.append('email', email);
        formData.append('lang', languageSelect.value);
        formData.append('engine', ocrEngineSelect.value);
        formData.append('outputFormat', emailOutputFormat);

        if (googleVisionApiKeyInput?.value) {
            formData.append('googleApiKey', googleVisionApiKeyInput.value.trim());
        }
        if (geminiApiKeyInput?.value) {
            formData.append('geminiApiKey', geminiApiKeyInput.value.trim());
        }
        if (openRouterApiKeyInput?.value) {
            formData.append('openRouterApiKey', openRouterApiKeyInput.value.trim());
        }
        if (openRouterOutputFormatSelect?.value) {
            formData.append('openRouterOutputFormat', openRouterOutputFormatSelect.value);
        }
        if (openRouterCustomModelInput?.value) {
            formData.append('openRouterCustomModel', openRouterCustomModelInput.value.trim());
        }
        if (advancedSettings.customPrompt) {
            formData.append('customPrompt', advancedSettings.customPrompt);
        }
        formData.append('skipPreprocessing', advancedSettings.skipPreprocessing);

        for (const fileObj of filesData) {
            if (!fileObj.file) {
                console.warn('Missing file blob for:', fileObj.name);
                continue;
            }
            formData.append('files', fileObj.file, fileObj.name);
        }

        console.log(`Submitting job: ${filesData.length} files, formData entries:`, [...formData.entries()].filter(([k]) => k === 'files').length);

        const jobResp = await fetch('/api/job/create', {
            method: 'POST',
            body: formData,
        });

        let jobData;
        try {
            jobData = await jobResp.json();
        } catch {
            showEmailError('Server error. Check console for details.');
            console.error('Job create response:', jobResp.status, await jobResp.text().catch(() => ''));
            setEmailBtnLoading(verifyAndSendBtn, false);
            return;
        }

        if (!jobResp.ok) {
            showEmailError(jobData.error || 'Failed to submit job.');
            setEmailBtnLoading(verifyAndSendBtn, false);
            return;
        }

        closeEmailOtpModal();
        activeJobId = jobData.jobId;
        showToast(`Job submitted! Results will be emailed to ${email}. You can close the browser.`, 5000);
        startJobProgressPolling(jobData.jobId, email);
    } catch {
        showEmailError('Network error. Please try again.');
    } finally {
        setEmailBtnLoading(verifyAndSendBtn, false);
    }
};

let jobPollTimerId = null;

const startJobProgressPolling = (jobId, email) => {
    stopJobProgressPolling();
    overallProgress.classList.remove('hidden');
    overallProgressCurrent.textContent = `Server job queued — results will be emailed to ${email}`;
    overallProgressText.textContent = 'Overall: 0 / ?';
    overallEtaText.textContent = '';
    overallProgressFill.style.width = '0%';

    jobPollTimerId = setInterval(async () => {
        try {
            const resp = await fetch(`/api/job/${jobId}/status`);
            if (!resp.ok) return;
            const job = await resp.json();

            const pct = job.file_count > 0
                ? Math.round((job.files_processed / job.file_count) * 100)
                : 0;
            overallProgressText.textContent = `Overall: ${job.files_processed} / ${job.file_count}`;
            overallProgressFill.style.width = `${pct}%`;

            if (job.status === 'processing') {
                overallProgressCurrent.textContent = `Processing on server... (${pct}%)`;
            } else if (job.status === 'done') {
                overallProgressCurrent.textContent = `Done! Results emailed to ${email}`;
                overallProgressFill.style.width = '100%';
                showToast(`OCR complete — results emailed to ${email}`, 4000);
                activeJobId = null;
                stopJobProgressPolling();
            } else if (job.status === 'failed') {
                overallProgressCurrent.textContent = `Job failed: ${job.error || 'Unknown error'}`;
                activeJobId = null;
                stopJobProgressPolling();
            }
        } catch { /* network error, keep polling */ }
    }, 3000);
};

const stopJobProgressPolling = () => {
    if (jobPollTimerId) {
        clearInterval(jobPollTimerId);
        jobPollTimerId = null;
    }
};

let activeJobId = null;

const checkActiveJob = async () => {
    const email = sessionStorage.getItem('ocr_email');
    if (!email) return;

    try {
        const resp = await fetch(`/api/job/active?email=${encodeURIComponent(email)}`);
        if (!resp.ok) return;
        const data = await resp.json();

        if (data.active && data.job) {
            activeJobId = data.job.id;
            startJobProgressPolling(data.job.id, email);
        }
    } catch { /* silent */ }
};

const openEmailOtpModalSafe = () => {
    if (activeJobId) {
        const email = sessionStorage.getItem('ocr_email') || '';
        showToast(`A job is already in progress for ${email}. Please wait for it to finish.`, 4000);
        return;
    }
    openEmailOtpModal();
};
