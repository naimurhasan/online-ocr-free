const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const fileList = document.getElementById('fileList');
const convertBtn = document.getElementById('convertBtn');
const emailContainer = document.getElementById('emailContainer');
const emailInput = document.getElementById('email');
const resultArea = document.getElementById('resultArea');
const outputText = document.getElementById('outputText');
const copyBtn = document.getElementById('copyBtn');
const languageSelect = document.getElementById('language');
const btnText = document.querySelector('.btn-text');
const btnLoading = document.querySelector('.btn-loading');

let selectedFiles = [];

// Drag & Drop Events
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

function handleFiles(files) {
    if (files.length > 0) {
        // Convert FileList to Array and filter valid types
        const newFiles = Array.from(files).filter(file =>
            file.type.startsWith('image/') || file.type === 'application/pdf'
        );

        selectedFiles = [...selectedFiles, ...newFiles];
        updateUI();
    }
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    updateUI();
}

function updateUI() {
    fileList.innerHTML = '';

    if (selectedFiles.length > 0) {
        fileList.classList.remove('hidden');
        convertBtn.disabled = false;

        selectedFiles.forEach((file, index) => {
            const div = document.createElement('div');
            div.className = 'file-item';
            div.innerHTML = `
                <div class="file-name">
                    <i class="fas ${file.type === 'application/pdf' ? 'fa-file-pdf' : 'fa-file-image'}"></i>
                    ${file.name}
                </div>
                <i class="fas fa-times remove-file" onclick="removeFile(${index})"></i>
            `;
            fileList.appendChild(div);
        });

        // Show/Hide Email based on batch count
        if (selectedFiles.length > 1) {
            emailContainer.classList.remove('hidden');
        } else {
            emailContainer.classList.add('hidden');
        }
    } else {
        fileList.classList.add('hidden');
        convertBtn.disabled = true;
        emailContainer.classList.add('hidden');
        // resultArea visibility is managed by convert process, not file selection
    }
}

convertBtn.addEventListener('click', async () => {
    if (selectedFiles.length === 0) return;

    if (selectedFiles.length > 1 && !emailInput.value) {
        alert('Please enter an email address for batch processing results.');
        emailInput.focus();
        return;
    }

    setLoading(true);
    resultArea.classList.add('hidden');
    outputText.value = '';

    const formData = new FormData();
    formData.append('lang', languageSelect.value);

    const isBatch = selectedFiles.length > 1;
    const endpoint = isBatch ? '/api/ocr/batch' : '/api/ocr';

    selectedFiles.forEach(file => {
        // For batch upload.array('files'), for single upload.single('file')
        // Our backend expects 'file' for single and 'files' for batch
        if (isBatch) {
            formData.append('files', file);
        } else {
            formData.append('file', file);
        }
    });

    if (isBatch) {
        formData.append('email', emailInput.value);
    }

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            body: formData
        });

        const data = await response.json();

        if (response.ok) {
            if (isBatch) {
                alert(data.message);
                // Clear files after batch submit
                selectedFiles = [];
                updateUI();
            } else {
                resultArea.classList.remove('hidden');
                outputText.value = data.text;
                // Scroll to result
                resultArea.scrollIntoView({ behavior: 'smooth' });

                // Clear files after single file processing too
                selectedFiles = [];
                fileInput.value = ''; // Allow re-selecting same file
                updateUI();
            }
        } else {
            alert('Error: ' + data.error);
        }

    } catch (error) {
        console.error('Error:', error);
        alert('An error occurred during processing.');
    } finally {
        setLoading(false);
    }
});

function setLoading(isLoading) {
    convertBtn.disabled = isLoading;
    if (isLoading) {
        btnText.classList.add('hidden');
        btnLoading.classList.remove('hidden');
    } else {
        btnText.classList.remove('hidden');
        btnLoading.classList.add('hidden');
    }
}

copyBtn.addEventListener('click', () => {
    outputText.select();
    document.execCommand('copy');

    const originalIcon = copyBtn.innerHTML;
    copyBtn.innerHTML = '<i class="fas fa-check"></i>';
    setTimeout(() => {
        copyBtn.innerHTML = originalIcon;
    }, 2000);
});
