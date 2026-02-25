// ── fileManager.js ── File handling, selection, removal, settings modal (depends on state.js, preview.js)

const handleFileSelect = async (e) => {
    if (batchProgress.running) return;
    const newFiles = Array.from(e.target.files);

    if (fileInput) fileInput.value = '';

    if (newFiles.length === 0) return;

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
    const skipped = [];
    for (const file of newFiles) {
        if (file.size > MAX_FILE_SIZE) {
            skipped.push(file.name);
            continue;
        }
        addFileToState(file, file.name);
    }
    if (skipped.length > 0) {
        showAppAlert(`${skipped.length} file${skipped.length > 1 ? 's' : ''} skipped (over 50 MB limit):\n${skipped.join(', ')}`, { title: 'File Too Large' });
    }

    renderFileList();

    if (!activeFileId && filesData.length > 0) {
        selectFile(filesData[filesData.length - 1].id);
    }

    updateGlobalButtons();
};

const addFileToState = (file, name) => {
    const id = crypto.randomUUID();
    const isPdf = file.type === 'application/pdf' || name.toLowerCase().endsWith('.pdf');
    const fileObj = {
        id,
        file,
        name: name,
        type: isPdf ? 'pdf' : 'image',
        status: 'pending', // pending, processing, done, error
        text: '',
        pages: [],
        currentPage: 0,
        startPage: null,
        endPage: null,
        totalPages: null,
        columnConfig: { active: false, numColumns: 1, splitPositions: [] },
        rotation: 0,
        activeViewerPage: 1,
        previewUrl: isPdf ? 'https://placehold.co/50x70?text=PDF' : URL.createObjectURL(file),
        pdfViewerUrl: isPdf ? URL.createObjectURL(file) : null
    };

    if (isPdf) {
        generatePdfThumbnail(fileObj);
    }

    filesData.push(fileObj);
};

const generatePdfThumbnail = async (fileObj, pageNum = 1) => {
    try {
        const pdfjs = await ensurePdfJsLoaded();
        const arrayBuffer = await fileObj.file.arrayBuffer();
        const pdf = await pdfjs.getDocument(arrayBuffer).promise;
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

        const stillPresent = filesData.some((f) => f.id === fileObj.id);
        if (!stillPresent) {
            URL.revokeObjectURL(thumbUrl);
            return;
        }

        fileObj.previewUrl = thumbUrl;

        const imgEl = fileList.querySelector(`.file-item[data-file-id="${fileObj.id}"] img`);
        if (imgEl) imgEl.src = thumbUrl;

        if (activeFileId === fileObj.id) {
            renderPreview();
        }

    } catch (err) {
        console.error("Error generating PDF thumbnail:", err);
    }
};

const selectFile = (id) => {
    const file = filesData.find(f => f.id === id);
    if (!file) {
        activeFileId = null;
        syncColumnsFromFile(null);
        updateColumnsButtonUI();
        renderFileList();
        renderPreview();
        renderResult();
        return;
    }

    activeFileId = id;
    syncColumnsFromFile(file);
    updateColumnsButtonUI();
    resetZoomPan();
    renderFileList();
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
            }
        }
        renderFileList();
        renderPreview();
        renderResult();
        updateGlobalButtons();
    }
};

// ── File settings modal (rotation + PDF page range) ──

let settingsFileId = null;
let settingsRotation = 0;

const getPdfTotalPages = async (file) => {
    if (file.totalPages && file.totalPages > 0) {
        return file.totalPages;
    }
    const pdfjs = await ensurePdfJsLoaded();
    const arrayBuffer = await file.file.arrayBuffer();
    const pdf = await pdfjs.getDocument(arrayBuffer).promise;
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

    closeSettings();

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
