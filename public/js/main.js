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
const settingsModal = document.getElementById('settingsModal');
const settingsFileName = document.getElementById('settingsFileName');
const startPageInput = document.getElementById('startPage');
const endPageInput = document.getElementById('endPage');
const cancelSettingsBtn = document.getElementById('cancelSettingsBtn');
const saveSettingsBtn = document.getElementById('saveSettingsBtn');
const addFilesBtn = document.getElementById('addFilesBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const clearAllBtn = document.getElementById('clearAllBtn');
const fileList = document.getElementById('fileList');
const previewContainer = document.getElementById('previewContainer');
const previewName = document.getElementById('previewName');
const outputText = document.getElementById('outputText');
const processBtn = document.getElementById('processBtn');
const copyBtn = document.getElementById('copyBtn');
const downloadTextBtn = document.getElementById('downloadTextBtn');
const themeToggleBtn = document.getElementById('themeToggle');
const languageSelect = document.getElementById('language');
const fileCountSpan = document.getElementById('fileCount');

// --- Initialization ---
const init = () => {
    initTheme();
    setupEventListeners();
};

const setupEventListeners = () => {
    // File adding
    addFilesBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);

    // Drag & Drop
    fileList.addEventListener('click', (e) => {
        // If clicking the empty state (not the list container itself), open file dialog
        if (e.target.closest('.empty-state')) {
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
        fileList.classList.remove('drag-over');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files; // Optional: sync input
            handleFileSelect({ target: { files: e.dataTransfer.files } });
        }
    });

    // Global Actions
    clearAllBtn.addEventListener('click', clearAll);
    downloadAllBtn.addEventListener('click', downloadAllZip);

    // Result Actions
    processBtn.addEventListener('click', processActiveFile);
    copyBtn.addEventListener('click', copyToClipboard);
    downloadTextBtn.addEventListener('click', downloadActiveText);

    // Theme
    themeToggleBtn.addEventListener('click', toggleTheme);

    // Pagination
    document.getElementById('prevPageBtn').addEventListener('click', () => navigatePage(-1));
    document.getElementById('nextPageBtn').addEventListener('click', () => navigatePage(1));

    // Settings Modal
    cancelSettingsBtn.addEventListener('click', closeSettings);
    saveSettingsBtn.addEventListener('click', saveSettings);

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

// --- File Handling ---
const handleFileSelect = async (e) => {
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
        alert(`Failed to process PDF: ${file.name}`);
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

const generatePdfThumbnail = async (fileObj) => {
    try {
        const arrayBuffer = await fileObj.file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 }); // Smaller scale for thumbnail
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
    resetZoomPan();
    renderFileList(); // Update active class
    renderPreview();
    renderResult();
};

const clearAll = () => {
    filesData.forEach(f => {
        URL.revokeObjectURL(f.previewUrl);
        if (f.pdfViewerUrl) URL.revokeObjectURL(f.pdfViewerUrl);
    });
    filesData = [];
    activeFileId = null;
    renderFileList();
    renderPreview();
    renderResult();
    updateGlobalButtons();
};

const removeFile = (id) => {
    const fileIndex = filesData.findIndex(f => f.id === id);
    if (fileIndex !== -1) {
        URL.revokeObjectURL(filesData[fileIndex].previewUrl);
        if (filesData[fileIndex].pdfViewerUrl) {
            URL.revokeObjectURL(filesData[fileIndex].pdfViewerUrl);
        }
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

const openSettings = (id) => {
    const file = filesData.find(f => f.id === id);
    if (!file) return;

    settingsFileId = id;
    settingsFileName.textContent = file.name;
    startPageInput.value = file.startPage || '';
    endPageInput.value = file.endPage || '';

    settingsModal.classList.remove('hidden');
};

const closeSettings = () => {
    settingsModal.classList.add('hidden');
    settingsFileId = null;
    startPageInput.value = '';
    endPageInput.value = '';
};

const saveSettings = () => {
    if (!settingsFileId) return;
    const file = filesData.find(f => f.id === settingsFileId);
    if (file) {
        file.startPage = startPageInput.value ? parseInt(startPageInput.value, 10) : null;
        file.endPage = endPageInput.value ? parseInt(endPageInput.value, 10) : null;
    }
    closeSettings();
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
    addMoreItem.onclick = () => fileInput.click();
    fileList.appendChild(addMoreItem);

    filesData.forEach(file => {
        const item = document.createElement('div');
        item.className = `file-item ${file.id === activeFileId ? 'active' : ''}`;
        item.onclick = () => selectFile(file.id);

        let statusIcon = '';
        if (file.status === 'processing') statusIcon = '<div class="status-overlay"><i class="fas fa-spinner fa-spin"></i></div>';
        else if (file.status === 'done') statusIcon = '<div class="status-overlay done"><i class="fas fa-check"></i></div>';
        else if (file.status === 'error') statusIcon = '<div class="status-overlay error"><i class="fas fa-exclamation"></i></div>';

        const settingsButtonHtml = file.type === 'pdf' ? `
            <button class="settings-file-btn" title="PDF Settings" onclick="event.stopPropagation(); openSettings('${file.id}')">
                <i class="fas fa-cog"></i>
            </button>
        ` : '';

        item.innerHTML = `
            <button class="remove-file-btn" title="Remove File" onclick="event.stopPropagation(); removeFile('${file.id}')">
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

const applyTransform = () => {
    const viewport = previewContainer.querySelector('.preview-viewport');
    if (viewport) {
        viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;
    }
};

const handleZoomWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    zoomLevel = Math.min(5, Math.max(0.2, zoomLevel + delta));
    applyTransform();
};

const handlePanStart = (e) => {
    if (e.target.closest('.zoom-controls')) return;
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
    resetZoomPan();
    applyTransform();
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
            if (file.pdfViewerUrl) {
                previewContainer.innerHTML = `
                    <object data="${file.pdfViewerUrl}" type="application/pdf" width="100%" height="100%" style="border: none; display: block;">
                        <iframe src="${file.pdfViewerUrl}" width="100%" height="100%" style="border: none;">
                            <p>Your browser does not support PDFs. <a href="${file.pdfViewerUrl}">Download the PDF</a>.</p>
                        </iframe>
                    </object>
                `;
            } else {
                previewContainer.innerHTML = '<div class="empty-preview"><p>Generating preview...</p></div>';
            }
            return;
        }
    } else {
        src = file.previewUrl;
        paginationControls.classList.add('hidden');
    }

    // Create viewport wrapper for zoom/pan
    const viewport = document.createElement('div');
    viewport.className = 'preview-viewport';
    viewport.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomLevel})`;

    const img = document.createElement('img');
    img.src = src;
    img.className = 'preview-image';
    viewport.appendChild(img);
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

const navigatePage = (direction) => {
    const file = filesData.find(f => f.id === activeFileId);
    if (!file || file.type !== 'pdf' || file.pages.length === 0) return;

    const newPage = file.currentPage + direction;
    if (newPage < 0 || newPage >= file.pages.length) return;

    file.currentPage = newPage;
    resetZoomPan();
    renderPreview();
    renderResult();
};

const renderResult = () => {
    const file = filesData.find(f => f.id === activeFileId);
    if (!file) {
        outputText.value = '';
        processBtn.disabled = true;
        outputText.disabled = true;
        return;
    }

    if (file.type === 'pdf') {
        const page = file.pages[file.currentPage];
        outputText.value = page ? page.text : '';
    } else {
        outputText.value = file.text;
    }

    outputText.disabled = false;

    // Process Button State
    // Use global processBtn
    if (processBtn) {
        if (file.status === 'processing') {
            processBtn.disabled = true;
            processBtn.classList.add('disabled');
            processBtn.textContent = 'Processing...';
        } else {
            processBtn.disabled = false;
            processBtn.classList.remove('disabled');
            processBtn.removeAttribute('disabled');
            processBtn.textContent = file.status === 'done' ? 'Reprocess OCR' : 'Start OCR Processing';
        }
    }
};

const updateGlobalButtons = () => {
    const hasFiles = filesData.length > 0;
    const hasDoneFiles = filesData.some(f => f.status === 'done');
    downloadAllBtn.disabled = !hasDoneFiles;
};

// --- Actions ---
const processActiveFile = async () => {
    const file = filesData.find(f => f.id === activeFileId);
    if (!file) return;

    file.status = 'processing';
    renderFileList();
    renderResult(); // Updates UI to show processing state

    if (file.type === 'pdf') {
        await processPdfDocument(file);
    } else {
        await processSingleImage(file);
    }
};

const processSingleImage = async (file) => {
    const formData = new FormData();
    formData.append('file', file.file);
    formData.append('lang', languageSelect.value);

    try {
        const response = await fetch('/api/ocr', { method: 'POST', body: formData });
        const data = await response.json();

        if (response.ok) {
            file.text = data.text;
            file.status = 'done';
        } else {
            file.text = "Error: " + (data.error || 'Unknown error');
            file.status = 'error';
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
        file.pages = []; // Reset pages

        let start = file.startPage && file.startPage > 0 ? file.startPage : 1;
        let end = file.endPage && file.endPage > 0 && file.endPage <= pdf.numPages ? file.endPage : pdf.numPages;

        if (start > end) {
            start = 1;
            end = pdf.numPages;
        }

        for (let i = start; i <= end; i++) {
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
            const imageUrl = URL.createObjectURL(blob);

            // 2. Add to pages array (initially without text)
            file.pages.push({
                pageNum: i,
                imgUrl: imageUrl,
                text: 'Processing...'
            });

            renderPreview(); // Show new page image
            renderResult();  // Show "Processing..." in text area

            // 3. Send to OCR
            const formData = new FormData();
            formData.append('file', blob, `page_${i}.png`);
            formData.append('lang', languageSelect.value);

            try {
                const response = await fetch('/api/ocr', { method: 'POST', body: formData });
                const data = await response.json();
                if (response.ok) {
                    file.pages[pageIndex].text = data.text;
                } else {
                    file.pages[pageIndex].text = "Error: " + (data.error || 'Unknown error');
                }
            } catch (err) {
                file.pages[pageIndex].text = "Error: Connection failed";
            }

            renderResult(); // Update text area with result
        }

        file.status = 'done';
    } catch (err) {
        console.error("PDF Processing Error:", err);
        file.status = 'error';
        alert(`Failed to process PDF: ${err.message || err}`);
    }

    renderFileList();
    renderPreview(); // Ensure controls are updated
    updateGlobalButtons();
};

const copyToClipboard = () => {
    navigator.clipboard.writeText(outputText.value);
    // Could add brief visual feedback
};

const downloadActiveText = () => {
    const file = filesData.find(f => f.id === activeFileId);
    if (!file) return;

    let text = '';
    let name = file.name;

    if (file.type === 'pdf') {
        const page = file.pages[file.currentPage];
        if (!page) return;
        text = page.text;
        name = `${file.name}_page_${file.currentPage + 1}`;
    } else {
        text = file.text;
    }

    if (!text) return;

    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name + '.txt';
    a.click();
    URL.revokeObjectURL(url);
};

const downloadAllZip = async () => {
    // Collect all pages from all files
    let filesToZip = [];

    filesData.forEach(f => {
        if (f.status === 'done') {
            if (f.type === 'pdf') {
                f.pages.forEach(p => {
                    if (p.text) {
                        filesToZip.push({
                            filename: `${f.name}_page_${p.pageNum}.txt`,
                            text: p.text
                        });
                    }
                });
            } else if (f.text) {
                filesToZip.push({ filename: f.name + '.txt', text: f.text });
            }
        }
    });

    if (filesToZip.length === 0) return;

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
            alert('Failed to generate zip');
        }
    } catch (err) {
        console.error(err);
        alert('Download failed');
    } finally {
        downloadAllBtn.innerHTML = '<i class="fas fa-download"></i> Download All (Zip)';
    }
};

// Start
document.addEventListener('DOMContentLoaded', init);
