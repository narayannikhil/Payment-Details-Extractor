/* ═══════════════════════════════════════════════════════════════
   API Helper — handles all backend communication
   ═══════════════════════════════════════════════════════════════ */

const API_BASE = 'http://127.0.0.1:8002/api';

class Api {
    static getToken() {
        return localStorage.getItem('token');
    }

    static setToken(token) {
        localStorage.setItem('token', token);
    }

    static clearToken() {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }

    static getUser() {
        const u = localStorage.getItem('user');
        return u ? JSON.parse(u) : null;
    }

    static setUser(user) {
        localStorage.setItem('user', JSON.stringify(user));
    }

    static isLoggedIn() {
        return !!this.getToken();
    }

    static authHeaders() {
        return { Authorization: `Bearer ${this.getToken()}` };
    }

    // ── Auth ─────────────────────────────────────────────────

    static async register(username, email, password) {
        const res = await fetch(`${API_BASE}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Registration failed');
        this.setToken(data.access_token);
        this.setUser(data.user);
        return data;
    }

    static async login(username, password) {
        const res = await fetch(`${API_BASE}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Login failed');
        this.setToken(data.access_token);
        this.setUser(data.user);
        return data;
    }

    static async getMe() {
        const res = await fetch(`${API_BASE}/auth/me`, {
            headers: this.authHeaders(),
        });
        if (!res.ok) throw new Error('Session expired');
        return res.json();
    }

    static logout() {
        this.clearToken();
        window.location.href = 'index.html';
    }

    // ── Payments ─────────────────────────────────────────────

    static async uploadPayment(file, sportId) {
        const form = new FormData();
        form.append('file', file);
        if (sportId) form.append('sport_id', sportId);

        const res = await fetch(`${API_BASE}/payments/upload`, {
            method: 'POST',
            headers: this.authHeaders(),
            body: form,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Upload failed');
        return data;
    }

    static async getPayments(params = {}) {
        const qs = new URLSearchParams();
        if (params.sport_id) qs.set('sport_id', params.sport_id);
        if (params.status) qs.set('status', params.status);
        if (params.search) qs.set('search', params.search);

        const res = await fetch(`${API_BASE}/payments?${qs}`, {
            headers: this.authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load payments');
        return res.json();
    }

    static async getPayment(id) {
        const res = await fetch(`${API_BASE}/payments/${id}`, {
            headers: this.authHeaders(),
        });
        if (!res.ok) throw new Error('Payment not found');
        return res.json();
    }

    static async updatePayment(id, data) {
        const res = await fetch(`${API_BASE}/payments/${id}`, {
            method: 'PUT',
            headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.detail || 'Update failed');
        return result;
    }

    static async deletePayment(id) {
        const res = await fetch(`${API_BASE}/payments/${id}`, {
            method: 'DELETE',
            headers: this.authHeaders(),
        });
        if (!res.ok) throw new Error('Delete failed');
    }

    // ── Sports ───────────────────────────────────────────────

    static async getSports() {
        const res = await fetch(`${API_BASE}/sports`, {
            headers: this.authHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load sports');
        return res.json();
    }

    static async createSport(name, icon, description) {
        const res = await fetch(`${API_BASE}/sports`, {
            method: 'POST',
            headers: { ...this.authHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, icon, description }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Failed to create sport');
        return data;
    }
}

// ── Toast helper ─────────────────────────────────────────────

function showToast(message, type = 'info') {
    let container = document.querySelector('.toast-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'toast-container';
        document.body.appendChild(container);
    }

    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <span class="toast-msg">${message}</span>
    `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// ── Auth guard ───────────────────────────────────────────────

function requireAuth() {
    if (!Api.isLoggedIn()) {
        window.location.href = 'index.html';
        return false;
    }
    return true;
}
