/* ═══════════════════════════════════════════════════════════════
   Auth Page Logic — Login & Register
   ═══════════════════════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', () => {
    // If already logged in, redirect
    if (Api.isLoggedIn()) {
        window.location.href = 'dashboard.html';
        return;
    }

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginCard = document.getElementById('login-card');
    const registerCard = document.getElementById('register-card');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');

    // Toggle forms
    showRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginCard.classList.add('hidden');
        registerCard.classList.remove('hidden');
    });

    showLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerCard.classList.add('hidden');
        loginCard.classList.remove('hidden');
    });

    // Login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.classList.remove('show');
        const btn = loginForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Signing in...';

        try {
            const username = document.getElementById('login-username').value.trim();
            const password = document.getElementById('login-password').value;
            await Api.login(username, password);
            window.location.href = 'dashboard.html';
        } catch (err) {
            loginError.textContent = err.message;
            loginError.classList.add('show');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Sign In';
        }
    });

    // Register
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.classList.remove('show');
        const btn = registerForm.querySelector('button');
        btn.disabled = true;
        btn.textContent = 'Creating account...';

        try {
            const username = document.getElementById('reg-username').value.trim();
            const email = document.getElementById('reg-email').value.trim();
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;

            if (password !== confirm) throw new Error('Passwords do not match');
            if (password.length < 6) throw new Error('Password must be at least 6 characters');

            await Api.register(username, email, password);
            window.location.href = 'dashboard.html';
        } catch (err) {
            registerError.textContent = err.message;
            registerError.classList.add('show');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create Account';
        }
    });
});
