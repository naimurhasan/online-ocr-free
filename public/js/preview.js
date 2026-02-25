// ── preview.js ── Preview rendering, zoom/pan, columns, navigation, result display (depends on state.js)

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

    const addMoreItem = document.createElement('div');
    addMoreItem.className = 'file-item add-more-item';
    addMoreItem.innerHTML = `
        <i class="fas fa-plus"></i>
        <span class="file-name">Add more files</span>
    `;
    fileList.appendChild(addMoreItem);

    filesData.forEach(file => {
        const item = document.createElement('div');
        item.className = `file-item ${file.id === activeFileId ? 'active' : ''}`;
        item.dataset.fileId = file.id;

        let statusIcon = '';
        if (file.status === 'processing') statusIcon = '<div class="status-overlay"><i class="fas fa-spinner fa-spin"></i></div>';
        else if (file.status === 'done') statusIcon = '<div class="status-overlay done"><i class="fas fa-check"></i></div>';
        else if (file.status === 'error') statusIcon = '<div class="status-overlay error"><i class="fas fa-exclamation"></i></div>';

        const controlDisabledAttr = batchProgress.running ? 'disabled' : '';
        const settingsButtonHtml = `
            <button type="button" class="settings-file-btn" title="File Settings" data-file-id="${file.id}" ${controlDisabledAttr}>
                <i class="fas fa-cog"></i>
            </button>
        `;

        item.innerHTML = `
            <button type="button" class="remove-file-btn" title="Remove File" data-file-id="${file.id}" ${controlDisabledAttr}>
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
        if (paginationControls) paginationControls.classList.add('hidden');
        previewContainer.innerHTML = '<div class="empty-preview"><p>Select a file to preview</p></div>';
        resetSplitUI();
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
            const showCustomViewer = file.type === 'pdf'
                && file.rotation === 0
                && (globalColumnsConfigs.numColumns === 1 || globalColumnsConfigs.active);

            if (showCustomViewer) {
                paginationControls.classList.remove('hidden');
                pageIndicator.textContent = `Page ${file.activeViewerPage || 1} of ...`;
                prevPageBtn.disabled = true;
                nextPageBtn.disabled = true;

                previewContainer.innerHTML = '<div class="pdf-custom-viewer" id="customPdfViewer"></div>';
                const customViewer = document.getElementById('customPdfViewer');

                file.file.arrayBuffer().then(arrayBuffer => {
                    return pdfjsLib.getDocument(arrayBuffer).promise;
                }).then(pdf => {
                    const totalPages = pdf.numPages;
                    const safeActivePage = Math.min(Math.max(file.activeViewerPage || 1, 1), totalPages);
                    file.activeViewerPage = safeActivePage;
                    pageIndicator.textContent = `Page ${safeActivePage} of ${totalPages}`;

                    const observer = new IntersectionObserver((entries) => {
                        let mostVisiblePage = file.activeViewerPage;
                        let maxRatio = 0;

                        entries.forEach(entry => {
                            const pageNum = parseInt(entry.target.dataset.page);
                            if (entry.isIntersecting) {
                                if (!entry.target.dataset.rendered) {
                                    entry.target.dataset.rendered = 'true';
                                    entry.target.innerHTML = '';
                                    const canvas = document.createElement('canvas');
                                    entry.target.appendChild(canvas);

                                    pdf.getPage(pageNum).then(page => {
                                        const viewport = page.getViewport({ scale: 1.5 });
                                        canvas.height = viewport.height;
                                        canvas.width = viewport.width;
                                        entry.target.style.height = viewport.height + 'px';

                                        const context = canvas.getContext('2d');
                                        page.render({ canvasContext: context, viewport: viewport });
                                    });
                                }

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

                    for (let i = 1; i <= pdf.numPages; i++) {
                        const pageContainer = document.createElement('div');
                        pageContainer.className = 'pdf-page-container';
                        pageContainer.dataset.page = i;
                        pageContainer.style.height = '800px';
                        pageContainer.style.width = '100%';
                        pageContainer.style.maxWidth = '800px';

                        customViewer.appendChild(pageContainer);
                        observer.observe(pageContainer);
                    }

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
            } else {
                previewContainer.innerHTML = '<div class="empty-preview"><p>Generating preview...</p></div>';
                return;
            }
        }
    } else {
        src = file.previewUrl;
        paginationControls.classList.add('hidden');
    }

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

    if (globalColumnsConfigs.numColumns > 1) {
        globalColumnsConfigs.splitPositions.forEach((pos, index) => {
            const splitter = document.createElement('div');
            splitter.className = 'column-splitter';
            splitter.style.left = `${pos * 100}%`;
            splitter.dataset.index = index;

            if (!globalColumnsConfigs.active) {
                setupSplitterDrag(splitter, imgWrapper);
            } else {
                splitter.style.pointerEvents = 'none';
            }

            imgWrapper.appendChild(splitter);
        });
    }

    previewContainer.appendChild(viewport);

    const zoomCtrl = document.createElement('div');
    zoomCtrl.className = 'zoom-controls';
    zoomCtrl.innerHTML = `
        <button onclick="zoomIn()" title="Zoom In"><i class="fas fa-search-plus"></i></button>
        <button onclick="zoomOut()" title="Zoom Out"><i class="fas fa-search-minus"></i></button>
        <button onclick="zoomReset()" title="Reset"><i class="fas fa-expand"></i></button>
    `;
    previewContainer.appendChild(zoomCtrl);
};

const setupColumns = (cols) => {
    globalColumnsConfigs.numColumns = cols;
    if (cols === 1) {
        globalColumnsConfigs.active = false;
        globalColumnsConfigs.splitPositions = [];
    } else {
        globalColumnsConfigs.active = false;
        globalColumnsConfigs.splitPositions = [];
        for (let i = 1; i < cols; i++) {
            globalColumnsConfigs.splitPositions.push(i / cols);
        }
    }

    const activeFile = filesData.find(f => f.id === activeFileId);
    syncColumnsToFile(activeFile);
    updateColumnsButtonUI();

    recenterPreviewView();
    updateGlobalButtons();
};

const setupSplitterDrag = (splitter, container) => {
    let isDragging = false;

    splitter.addEventListener('mousedown', (e) => {
        isDragging = true;
        splitter.classList.add('dragging');
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;

        const rect = container.getBoundingClientRect();
        let x = (e.clientX - rect.left) / zoomLevel;
        let percentage = x / (rect.width / zoomLevel);

        percentage = Math.max(0.01, Math.min(0.99, percentage));

        const index = parseInt(splitter.dataset.index, 10);

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
    if (openRouterOutputFormatSelect) openRouterOutputFormatSelect.disabled = isProcessing || !isOpenRouterSelected();
    if (googleVisionApiKeyInput) googleVisionApiKeyInput.disabled = isProcessing || !isGoogleVisionSelected();
    if (openRouterApiKeyInput) openRouterApiKeyInput.disabled = isProcessing || !isOpenRouterSelected();
};
