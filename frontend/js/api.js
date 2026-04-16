const API_BASE = '/api';

const API_AUTH = `${API_BASE}/auth`;
const API_CONVIDADOS = `${API_BASE}/convidados`;
const API_CHECKINS = `${API_BASE}/checkins`;

function getUser() {
    const user = sessionStorage.getItem('wedding_user');
    return user ? JSON.parse(user) : null;
}

function getToken() {
    return sessionStorage.getItem('wedding_token');
}

function logout() {
    sessionStorage.removeItem('wedding_user');
    sessionStorage.removeItem('wedding_token');
    window.location.href = '../index.html'; 
}

function configurarNavbar(caminhoIndex = 'index.html') {
    const user = getUser();
    const userInfo = document.getElementById('user-info');
    const btnLogout = document.getElementById('btn-logout');

    if (userInfo && user) {
        userInfo.innerHTML = `<i class="bi bi-person-circle"></i> ${user.nome} <span class="badge bg-secondary ms-1">${user.perfil}</span>`;
    }

    if (btnLogout) {
        btnLogout.addEventListener('click', logout);
    }
}