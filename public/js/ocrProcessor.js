// ── ocrProcessor.js ── OCR processing, progress UI, export, utilities (depends on state.js, settings.js, preview.js)

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

    const concurrency = Math.max(1, Math.min(advancedSettings.concurrentThreads, serverMaxThreads));

    if (concurrency <= 1) {
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
    } else {
        const inFlight = new Set();
        let index = 0;

        const launchNext = () => {
            if (index >= filesToProcess.length) return null;
            const file = filesToProcess[index++];

            prepareFileForProcessing(file);
            renderFileList();
            updateOverallProgressUI();

            const promise = (async () => {
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
                }
                batchProgress.completedFiles += 1;
                renderFileList();
                renderResult();
                updateOverallProgressUI();
                updateGlobalButtons();
            })();

            inFlight.add(promise);
            promise.finally(() => inFlight.delete(promise));
            return promise;
        };

        while (inFlight.size < concurrency && index < filesToProcess.length) {
            launchNext();
        }

        while (inFlight.size > 0) {
            await Promise.race(inFlight);
            while (inFlight.size < concurrency && index < filesToProcess.length) {
                launchNext();
            }
        }
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
        file.pages = [];

        let start = file.startPage && file.startPage > 0 ? file.startPage : 1;
        let end = file.endPage && file.endPage > 0 && file.endPage <= pdf.numPages ? file.endPage : pdf.numPages;

        if (start > end) {
            start = 1;
            end = pdf.numPages;
        }

        const totalPagesToProcess = end - start + 1;
        const concurrency = Math.max(1, Math.min(advancedSettings.concurrentThreads, serverMaxThreads));

        let ocrCompleted = 0;
        const pageNumbers = [];
        for (let i = start; i <= end; i++) pageNumbers.push(i);

        for (let chunkStart = 0; chunkStart < pageNumbers.length; chunkStart += concurrency) {
            const chunk = pageNumbers.slice(chunkStart, chunkStart + concurrency);

            const chunkJobs = [];
            for (const pageNum of chunk) {
                if (batchProgress.running) {
                    batchProgress.currentFileName = `${file.name} (page ${pageNum - start + 1}/${totalPagesToProcess})`;
                    updateOverallProgressUI();
                }

                const pageIndex = file.pages.length;
                const page = await pdf.getPage(pageNum);
                const viewport = page.getViewport({ scale: 2.0 });
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.height = viewport.height;
                canvas.width = viewport.width;
                await page.render({ canvasContext: context, viewport: viewport }).promise;

                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
                const workingBlob = await rotateImageBlob(blob, file.rotation || 0);
                const imageUrl = URL.createObjectURL(workingBlob);

                file.pages.push({ pageNum, imgUrl: imageUrl, text: 'Processing...' });
                chunkJobs.push({ pageIndex, pageNum, workingBlob });

                canvas.width = 0;
                canvas.height = 0;
            }
            renderPreview();
            renderResult();

            const ocrPromises = chunkJobs.map(job => (async () => {
                try {
                    if (fileColumns.active && fileColumns.numColumns > 1) {
                        const textParts = [];
                        const splits = [0, ...fileColumns.splitPositions, 1];
                        for (let c = 0; c < splits.length - 1; c++) {
                            const croppedBlob = await cropImageBlob(job.workingBlob, splits[c], splits[c + 1]);
                            const formData = new FormData();
                            formData.append('file', croppedBlob, `page_${job.pageNum}_col_${c + 1}.png`);
                            appendOcrConfigToFormData(formData);
                            const response = await fetch('/api/ocr', { method: 'POST', body: formData });
                            const data = await response.json();
                            textParts.push(response.ok ? data.text : `[Error Col ${c + 1}: ${data.error || 'Unknown'}]`);
                        }
                        file.pages[job.pageIndex].text = textParts.join('\n\n--- Column Break ---\n\n');
                    } else {
                        const formData = new FormData();
                        formData.append('file', job.workingBlob, `page_${job.pageNum}.png`);
                        appendOcrConfigToFormData(formData);
                        const response = await fetch('/api/ocr', { method: 'POST', body: formData });
                        const data = await response.json();
                        file.pages[job.pageIndex].text = response.ok ? data.text : "Error: " + (data.error || 'Unknown error');
                    }
                } catch (err) {
                    file.pages[job.pageIndex].text = "Error: Connection failed";
                }
                job.workingBlob = null;
                ocrCompleted++;
                if (batchProgress.running) {
                    batchProgress.currentFileName = `${file.name} (OCR: ${ocrCompleted}/${totalPagesToProcess})`;
                    updateOverallProgressUI();
                }
                renderResult();
            })());

            await Promise.all(ocrPromises);
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
    renderPreview();
    renderResult();
    updateGlobalButtons();
};

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

// ── Progress UI ──

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

// ── Export ──

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

// ── Utilities ──

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
