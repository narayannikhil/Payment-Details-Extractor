/* ═══════════════════════════════════════════════════════════════
   Upload Page Logic
   ═══════════════════════════════════════════════════════════════ */

let selectedFile = null;

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    setupSidebar();
    setupUserInfo();
    setupLogout();
    loadSportsForUpload();
    setupUploadZone();
    setupUploadForm();
});

// ── Load Sports into Select ──────────────────────────────────

async function loadSportsForUpload() {
    try {
        const sports = await Api.getSports();
        const select = document.getElementById('upload-sport');
        if (!select) return;
        select.innerHTML = '<option value="">Select a sport category</option>' +
            sports.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
    } catch (err) {
        console.error('Failed to load sports:', err);
    }
}

// ── Upload Zone (Drag & Drop) ────────────────────────────────

function setupUploadZone() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('file-input');
    const preview = document.getElementById('upload-preview');
    const previewImg = document.getElementById('preview-img');
    const fileName = document.getElementById('file-name');

    if (!zone) return;

    zone.addEventListener('dragover', (e) => {
        e.preventDefault();
        zone.classList.add('dragover');
    });

    zone.addEventListener('dragleave', () => {
        zone.classList.remove('dragover');
    });

    zone.addEventListener('drop', (e) => {
        e.preventDefault();
        zone.classList.remove('dragover');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelect(files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) handleFileSelect(fileInput.files[0]);
    });

    function handleFileSelect(file) {
        const allowed = ['image/jpeg', 'image/png', 'image/bmp', 'image/tiff', 'image/webp'];
        if (!allowed.includes(file.type)) {
            showToast('Please upload an image file (JPG, PNG, BMP, TIFF, WebP)', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            showToast('File size must be under 10 MB', 'error');
            return;
        }

        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            preview.classList.add('show');
            fileName.textContent = file.name;
        };
        reader.readAsDataURL(file);

        // Enable upload button
        document.getElementById('upload-btn').disabled = false;
    }
}

// ── Upload Form ──────────────────────────────────────────────

function setupUploadForm() {
    const form = document.getElementById('upload-form');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedFile) {
            showToast('Please select a screenshot first', 'error');
            return;
        }

        const btn = document.getElementById('upload-btn');
        const resultPanel = document.getElementById('ocr-result');
        btn.disabled = true;
        btn.innerHTML = '<div class="spinner" style="width:18px;height:18px;border-width:2px;margin-right:8px"></div> Uploading & Extracting...';

        try {
            const sportId = document.getElementById('upload-sport').value || null;
            const payment = await Api.uploadPayment(selectedFile, sportId);

            showToast('Payment uploaded and details extracted!', 'success');

            // Show OCR result
            renderOCRResult(payment, resultPanel);

            // Reset form for next upload
            selectedFile = null;
            document.getElementById('file-input').value = '';
            document.getElementById('upload-preview').classList.remove('show');

        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '📤 Upload & Extract';
        }
    });
}

function renderOCRResult(payment, container) {
    if (!container) return;
    container.classList.remove('hidden');

    const fields = [
        { label: 'Amount', value: payment.amount ? '₹' + payment.amount.toLocaleString('en-IN') : 'Not detected', icon: '💰' },
        { label: 'Transaction ID', value: payment.transaction_id || 'Not detected', icon: '🔢' },
        { label: 'UPI ID', value: payment.upi_id || 'Not detected', icon: '📱' },
        { label: 'Receiver', value: payment.receiver_name || 'Not detected', icon: '👤' },
        { label: 'Sender', value: payment.sender_name || 'Not detected', icon: '👤' },
        { label: 'Date', value: payment.date || 'Not detected', icon: '📅' },
        { label: 'Status', value: payment.status || 'Unknown', icon: '✔️' },
    ];

    container.innerHTML = `
        <div class="card">
            <div class="card-header">
                <h2>✨ Extracted Payment Details</h2>
                <a href="dashboard.html" class="btn btn-primary btn-sm">View Dashboard →</a>
            </div>
            <div class="d-flex gap-2 flex-wrap" style="align-items:flex-start">
                <div style="flex:0 0 200px">
                    <img src="http://127.0.0.1:8002/uploads/${payment.screenshot_path}" 
                         alt="Uploaded Screenshot" 
                         style="width:100%;border-radius:12px;border:1px solid var(--border)">
                </div>
                <div style="flex:1;min-width:250px">
                    <div class="field-grid">
                        ${fields.map(f => `
                            <div class="ocr-field">
                                <div class="field-label">${f.icon} ${f.label}</div>
                                <div class="field-value">${f.value}</div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
            ${payment.raw_ocr_text ? `
                <details class="mt-2">
                    <summary style="cursor:pointer;font-size:13px;color:var(--text-muted);margin-top:16px">📝 Show Raw OCR Text</summary>
                    <div class="ocr-raw">${escapeHtml(payment.raw_ocr_text)}</div>
                </details>
            ` : ''}
        </div>
    `;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
