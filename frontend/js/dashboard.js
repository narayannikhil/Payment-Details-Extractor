/* ═══════════════════════════════════════════════════════════════
   Dashboard Logic
   ═══════════════════════════════════════════════════════════════ */

let allPayments = [];
let allSports = [];
let currentFilters = {};

document.addEventListener('DOMContentLoaded', () => {
    if (!requireAuth()) return;
    initDashboard();
});

async function initDashboard() {
    setupSidebar();
    setupUserInfo();
    await Promise.all([loadSports(), loadPayments()]);
    setupFilters();
    setupLogout();
}

// ── Sidebar ──────────────────────────────────────────────────

function setupSidebar() {
    const hamburger = document.querySelector('.hamburger');
    const sidebar = document.querySelector('.sidebar');
    const overlay = document.querySelector('.sidebar-overlay');

    hamburger?.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('show');
    });

    overlay?.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
    });

    // Set active nav
    document.querySelectorAll('.nav-item[data-page]').forEach(item => {
        item.addEventListener('click', () => {
            const page = item.dataset.page;
            if (page) window.location.href = page;
        });
    });
}

function setupUserInfo() {
    const user = Api.getUser();
    if (!user) return;

    const avatar = document.querySelector('.user-avatar');
    const nameEl = document.querySelector('.user-details .name');
    const emailEl = document.querySelector('.user-details .email');

    if (avatar) avatar.textContent = user.username[0].toUpperCase();
    if (nameEl) nameEl.textContent = user.username;
    if (emailEl) emailEl.textContent = user.email;
}

function setupLogout() {
    document.getElementById('logout-btn')?.addEventListener('click', (e) => {
        e.preventDefault();
        Api.logout();
    });
}

// ── Load Data ────────────────────────────────────────────────

async function loadSports() {
    try {
        allSports = await Api.getSports();
        renderSportsNav();
        renderSportFilter();
    } catch (err) {
        console.error('Failed to load sports:', err);
    }
}

async function loadPayments() {
    try {
        allPayments = await Api.getPayments(currentFilters);
        renderStats();
        renderPaymentsTable();
    } catch (err) {
        showToast('Failed to load payments', 'error');
        if (err.message === 'Session expired') Api.logout();
    }
}

// ── Sports Nav ───────────────────────────────────────────────

function renderSportsNav() {
    const container = document.getElementById('sports-nav');
    if (!container) return;

    container.innerHTML = allSports.map(s => `
        <div class="nav-item sport-nav-item" data-sport-id="${s.id}">
            <span class="nav-icon">${s.icon}</span>
            <span>${s.name}</span>
        </div>
    `).join('');

    container.querySelectorAll('.sport-nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const id = parseInt(item.dataset.sportId);
            if (currentFilters.sport_id === id) {
                delete currentFilters.sport_id;
                item.classList.remove('active');
            } else {
                container.querySelectorAll('.sport-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                currentFilters.sport_id = id;
            }
            const sportSelect = document.getElementById('filter-sport');
            if (sportSelect) sportSelect.value = currentFilters.sport_id || '';
            loadPayments();
        });
    });
}

function renderSportFilter() {
    const select = document.getElementById('filter-sport');
    if (!select) return;

    select.innerHTML = '<option value="">All Sports</option>' +
        allSports.map(s => `<option value="${s.id}">${s.icon} ${s.name}</option>`).join('');
}

// ── Stats ────────────────────────────────────────────────────

function renderStats() {
    const total = allPayments.length;
    const totalAmount = allPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
    const completed = allPayments.filter(p => p.status?.toLowerCase().includes('success') || p.status?.toLowerCase().includes('completed')).length;
    const sportsUsed = new Set(allPayments.map(p => p.sport_id).filter(Boolean)).size;

    setText('stat-total', total);
    setText('stat-amount', '₹' + totalAmount.toLocaleString('en-IN'));
    setText('stat-completed', completed);
    setText('stat-sports', sportsUsed);
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
}

// ── Payments Table ───────────────────────────────────────────

function renderPaymentsTable() {
    const tbody = document.getElementById('payments-tbody');
    const emptyState = document.getElementById('empty-state');
    if (!tbody) return;

    if (allPayments.length === 0) {
        tbody.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    tbody.innerHTML = allPayments.map(p => {
        const sport = p.sport ? `<span class="badge badge-sport">${p.sport.icon} ${p.sport.name}</span>` : '<span class="text-muted">—</span>';
        const statusClass = getStatusClass(p.status);
        const date = p.date || formatDate(p.created_at);
        const amount = p.amount ? `₹${p.amount.toLocaleString('en-IN')}` : '—';

        return `
            <tr>
                <td>
                    <img src="http://127.0.0.1:8002/uploads/${p.screenshot_path}" 
                         alt="Screenshot" class="screenshot-thumb" 
                         onclick="showScreenshot('${p.screenshot_path}')">
                </td>
                <td class="truncate" style="max-width:120px">${p.transaction_id || '—'}</td>
                <td class="amount">${amount}</td>
                <td>${p.receiver_name || '—'}</td>
                <td>${sport}</td>
                <td>${date}</td>
                <td><span class="badge ${statusClass}">${p.status || 'Unknown'}</span></td>
                <td>
                    <div class="d-flex gap-2">
                        <button class="btn btn-secondary btn-sm" onclick="viewPayment(${p.id})" title="View">👁</button>
                        <button class="btn btn-danger btn-sm" onclick="deletePayment(${p.id})" title="Delete">🗑</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function getStatusClass(status) {
    if (!status) return 'badge-info';
    const s = status.toLowerCase();
    if (s.includes('success') || s.includes('completed')) return 'badge-success';
    if (s.includes('pending')) return 'badge-warning';
    if (s.includes('fail')) return 'badge-danger';
    return 'badge-info';
}

function formatDate(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Filters ──────────────────────────────────────────────────

function setupFilters() {
    const sportSelect = document.getElementById('filter-sport');
    const statusSelect = document.getElementById('filter-status');
    const searchInput = document.getElementById('filter-search');

    sportSelect?.addEventListener('change', () => {
        currentFilters.sport_id = sportSelect.value || undefined;
        // highlight sidebar sport
        document.querySelectorAll('.sport-nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.sportId === sportSelect.value);
        });
        loadPayments();
    });

    statusSelect?.addEventListener('change', () => {
        currentFilters.status = statusSelect.value || undefined;
        loadPayments();
    });

    let searchTimeout;
    searchInput?.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentFilters.search = searchInput.value.trim() || undefined;
            loadPayments();
        }, 400);
    });
}

// ── Actions ──────────────────────────────────────────────────

async function deletePayment(id) {
    if (!confirm('Delete this payment record?')) return;
    try {
        await Api.deletePayment(id);
        showToast('Payment deleted', 'success');
        loadPayments();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function viewPayment(id) {
    try {
        const p = await Api.getPayment(id);
        const modal = document.getElementById('payment-modal');
        const body = document.getElementById('modal-body');
        if (!modal || !body) return;

        const sport = p.sport ? `${p.sport.icon} ${p.sport.name}` : 'None';

        body.innerHTML = `
            <div style="display:flex;gap:20px;flex-wrap:wrap">
                <div style="flex:1;min-width:200px">
                    <img src="http://127.0.0.1:8002/uploads/${p.screenshot_path}" 
                         alt="Screenshot" 
                         style="width:100%;border-radius:12px;border:1px solid var(--border)">
                </div>
                <div style="flex:1;min-width:250px">
                    <div class="ocr-result">
                        <h3>📋 Extracted Details</h3>
                        <div class="field-grid">
                            <div class="ocr-field">
                                <div class="field-label">Amount</div>
                                <div class="field-value amount">${p.amount ? '₹' + p.amount.toLocaleString('en-IN') : '—'}</div>
                            </div>
                            <div class="ocr-field">
                                <div class="field-label">Transaction ID</div>
                                <div class="field-value">${p.transaction_id || '—'}</div>
                            </div>
                            <div class="ocr-field">
                                <div class="field-label">UPI ID</div>
                                <div class="field-value">${p.upi_id || '—'}</div>
                            </div>
                            <div class="ocr-field">
                                <div class="field-label">Receiver</div>
                                <div class="field-value">${p.receiver_name || '—'}</div>
                            </div>
                            <div class="ocr-field">
                                <div class="field-label">Sender</div>
                                <div class="field-value">${p.sender_name || '—'}</div>
                            </div>
                            <div class="ocr-field">
                                <div class="field-label">Date</div>
                                <div class="field-value">${p.date || formatDate(p.created_at)}</div>
                            </div>
                            <div class="ocr-field">
                                <div class="field-label">Status</div>
                                <div class="field-value"><span class="badge ${getStatusClass(p.status)}">${p.status}</span></div>
                            </div>
                            <div class="ocr-field">
                                <div class="field-label">Sport</div>
                                <div class="field-value">${sport}</div>
                            </div>
                        </div>
                    </div>
                    ${p.raw_ocr_text ? `
                        <details class="mt-2">
                            <summary style="cursor:pointer;font-size:13px;color:var(--text-muted)">📝 Raw OCR Text</summary>
                            <div class="ocr-raw">${escapeHtml(p.raw_ocr_text)}</div>
                        </details>
                    ` : ''}
                </div>
            </div>
        `;

        modal.classList.add('show');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function closeModal() {
    document.getElementById('payment-modal')?.classList.remove('show');
}

function showScreenshot(path) {
    const modal = document.getElementById('payment-modal');
    const body = document.getElementById('modal-body');
    if (!modal || !body) return;

    body.innerHTML = `
        <div style="text-align:center">
            <img src="http://127.0.0.1:8002/uploads/${path}" 
                 alt="Screenshot" 
                 style="max-width:100%;max-height:70vh;border-radius:12px;border:1px solid var(--border)">
        </div>
    `;
    modal.classList.add('show');
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
