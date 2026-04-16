document.addEventListener("DOMContentLoaded", () => {
    // Se o utilizador já estiver logado, redireciona-o automaticamente
    const user = getUser();
    if (user) {
        redirecionarPorPerfil(user.perfil);
    }

    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', efetuarLogin);
    }
});

async function efetuarLogin(e) {
    e.preventDefault();

    const email = document.getElementById('email').value;
    const senha = document.getElementById('senha').value;
    const errorDiv = document.getElementById('login-error');
    const btnLogin = document.getElementById('btn-login');

    // Estado de "A carregar" no botão
    errorDiv.classList.add('d-none');
    btnLogin.disabled = true;
    btnLogin.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> A entrar...';

    try {
        // Envia o pedido para o novo servidor monolítico (http://localhost:3000/api/auth/login)
        const res = await fetch(`${API_AUTH}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, senha })
        });

        const data = await res.json();

        if (res.ok) {
            // Guarda os dados na sessão
            sessionStorage.setItem('wedding_token', data.token);
            sessionStorage.setItem('wedding_user', JSON.stringify(data.usuario));
            
            // Redireciona com base no perfil
            redirecionarPorPerfil(data.usuario.perfil);
        } else {
            // Exibe o erro devolvido pelo backend (ex: "Credenciais inválidas")
            errorDiv.innerText = data.erro || "Erro ao efetuar login.";
            errorDiv.classList.remove('d-none');
        }
    } catch (error) {
        console.error("Erro na requisição:", error);
        errorDiv.innerText = "Erro de comunicação com o servidor. Verifique se o backend está ligado.";
        errorDiv.classList.remove('d-none');
    } finally {
        // Restaura o botão
        btnLogin.disabled = false;
        btnLogin.innerText = 'Entrar no Sistema';
    }
}

function redirecionarPorPerfil(perfil) {
    if (perfil === 'Admin') {
        window.location.href = 'admin/dashboard.html';
    } else if (perfil === 'Cerimonialista') {
        window.location.href = 'recepcao/checkin.html';
    } else {
        alert("Perfil desconhecido!");
    }
}