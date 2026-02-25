// ── trialFlow.js ── Free trial key claim modal

let _pendingTrialKey = null;
let trialResendTimer = null;

// ── helpers ──────────────────────────────────────────────

const applyTrialKey = () => {
    if (!_pendingTrialKey) return;
    if (googleVisionApiKeyInput) googleVisionApiKeyInput.value = _pendingTrialKey;
    if (typeof persistGoogleKeyIfAllowed === 'function') persistGoogleKeyIfAllowed();
    if (typeof updateGlobalButtons === 'function') updateGlobalButtons();
    _pendingTrialKey = null;
};

const clearTrialResendCooldown = () => {
    if (trialResendTimer) { clearTimeout(trialResendTimer); trialResendTimer = null; }
    if (trialResendOtpBtn) {
        trialResendOtpBtn.disabled = false;
        trialResendOtpBtn.textContent = 'Resend Code';
    }
};

const startTrialResendCooldown = (seconds) => {
    trialResendOtpBtn.disabled = true;
    let remaining = seconds;
    const tick = () => {
        trialResendOtpBtn.textContent = `Resend Code (${remaining}s)`;
        if (remaining <= 0) { clearTrialResendCooldown(); return; }
        remaining--;
        trialResendTimer = setTimeout(tick, 1000);
    };
    tick();
};

const setTrialBtnLoading = (btn, loading) => {
    btn.querySelector('.btn-text').classList.toggle('hidden', loading);
    btn.querySelector('.btn-spinner').classList.toggle('hidden', !loading);
    btn.disabled = loading;
};

const showTrialStep3 = (key, used, total) => {
    _pendingTrialKey = key;
    trialCreditsMsg.textContent = `${total - used} of ${total} credits remaining.`;
    trialStep1.classList.add('hidden');
    trialStep2.classList.add('hidden');
    trialStep3.classList.remove('hidden');
};

// ── modal open / close ────────────────────────────────────

const closeTrialModal = () => {
    try { applyTrialKey(); } catch (e) { console.error('applyTrialKey error:', e); }
    try { trialModal.classList.add('hidden'); } catch (e) { console.error('hide modal error:', e); }
    try { clearTrialResendCooldown(); } catch (e) { console.error('clearCooldown error:', e); }
};

const openTrialModal = async () => {
    trialStep1.classList.remove('hidden');
    trialStep2.classList.add('hidden');
    trialStep3.classList.add('hidden');
    trialError.classList.add('hidden');
    trialOtpInput.value = '';
    const savedEmail = sessionStorage.getItem('ocr_email') || '';
    if (savedEmail) trialEmailInput.value = savedEmail;
    trialModal.classList.remove('hidden');

    // Check if already claimed
    if (savedEmail) {
        try {
            const resp = await fetch(`/api/trial/status?email=${encodeURIComponent(savedEmail)}`);
            if (resp.ok) {
                const data = await resp.json();
                if (data.hasKey) showTrialStep3(data.trialKey, data.creditsUsed, data.creditsTotal);
            }
        } catch { /* silent */ }
    }
};

// ── handlers ─────────────────────────────────────────────

const handleTrialSendOtp = async () => {
    trialError.classList.add('hidden');
    const email = trialEmailInput.value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        trialError.textContent = 'Please enter a valid email address.';
        trialError.classList.remove('hidden');
        return;
    }
    setTrialBtnLoading(trialSendOtpBtn, true);
    try {
        const resp = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            trialError.textContent = data.error || 'Failed to send code.';
            trialError.classList.remove('hidden');
            return;
        }
        sessionStorage.setItem('ocr_email', email);
        trialOtpSentEmail.textContent = email;
        trialStep1.classList.add('hidden');
        trialStep2.classList.remove('hidden');
        trialOtpInput.focus();
        startTrialResendCooldown(60);
    } catch {
        trialError.textContent = 'Network error. Please try again.';
        trialError.classList.remove('hidden');
    } finally {
        setTrialBtnLoading(trialSendOtpBtn, false);
    }
};

const handleTrialClaim = async () => {
    trialError.classList.add('hidden');
    const email = trialEmailInput.value.trim();
    const otp = trialOtpInput.value.trim();
    if (!otp || otp.length !== 6) {
        trialError.textContent = 'Please enter the 6-digit code.';
        trialError.classList.remove('hidden');
        return;
    }
    setTrialBtnLoading(trialClaimBtn, true);
    try {
        const resp = await fetch('/api/trial/claim', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp }),
        });
        const data = await resp.json();
        if (!resp.ok) {
            trialError.textContent = data.error || 'Failed to claim key.';
            trialError.classList.remove('hidden');
            return;
        }
        showTrialStep3(data.trialKey, data.creditsUsed, data.creditsTotal);
    } catch {
        trialError.textContent = 'Network error. Please try again.';
        trialError.classList.remove('hidden');
    } finally {
        setTrialBtnLoading(trialClaimBtn, false);
    }
};
