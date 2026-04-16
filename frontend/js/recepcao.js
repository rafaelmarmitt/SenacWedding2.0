let currentUser = null;
let convidadosCache = []; // Nova variável para guardar a lista e permitir pesquisa rápida

// Inicialização da página
document.addEventListener("DOMContentLoaded", () => {
    currentUser = getUser();
    // Se não estiver logado, manda para o login
    if (!currentUser) return window.location.href = '../index.html';

    configurarNavbar('../index.html');

    // Mostra o botão do painel Admin apenas se for Administrador
    const adminActions = document.getElementById('admin-actions');
    if (adminActions) {
        if (currentUser.perfil === 'Admin') {
            adminActions.classList.remove('d-none');
        } else {
            adminActions.classList.add('d-none');
        }
    }

    // Carrega a lista completa de convidados do servidor uma única vez
    carregarConvidados();

    // Eventos do Modal de Cadastro
    document.getElementById('form-novo-convidado')?.addEventListener('submit', cadastrarConvidado);
    document.getElementById('modalNovoConvidado')?.addEventListener('hidden.bs.modal', () => {
        document.getElementById('form-novo-convidado').reset();
        document.getElementById('acompanhantes-container').innerHTML = '';
        document.getElementById('cadastro-msg').className = 'd-none';
    });
});

// Função para buscar os dados do servidor e guardar em cache
async function carregarConvidados() {
    try {
        const res = await fetch(API_CONVIDADOS);
        convidadosCache = await res.json();

        // Aplica o filtro atual (caso haja algo digitado na barra de pesquisa)
        const termoBusca = document.getElementById('busca-recepcao')?.value || '';
        buscarConvidados(termoBusca);
    } catch (error) {
        console.error("Erro ao carregar convidados:", error);
    }
}

// Filtra a lista localmente por Nome, CPF ou Mesa
function buscarConvidados(termo) {
    const tbody = document.getElementById('tabela-recepcao');
    if (!tbody) return;

    const termoLower = termo.toLowerCase().trim();
    const termoSemPontuacao = termoLower.replace(/\D/g, ''); // Facilita procurar CPFs sem usar pontos

    // Lógica de Filtro Multicampo
    const filtrados = convidadosCache.filter(c => {
        const nomeCompleto = `${c.nome} ${c.sobrenome}`.toLowerCase();
        const cpfNormal = c.cpf ? c.cpf.toLowerCase() : '';
        const cpfApenasNumeros = c.cpf ? c.cpf.replace(/\D/g, '') : '';
        const mesa = c.numero_mesa ? c.numero_mesa.toString() : '';

        return nomeCompleto.includes(termoLower) ||
            mesa.includes(termoLower) ||
            (cpfNormal && cpfNormal.includes(termoLower)) ||
            (cpfApenasNumeros && termoSemPontuacao && cpfApenasNumeros.includes(termoSemPontuacao));
    });

    if (!filtrados.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">Nenhum convidado encontrado com estes critérios.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(c => {
        const entrou = c.ja_entrou === 1 || c.ja_entrou === true;

        // Formatação dos acompanhantes exibindo os nomes
        const nomesAcompanhantes = c.acompanhantes && c.acompanhantes.length > 0
            ? `<i class="bi bi-people-fill text-muted"></i> ${c.acompanhantes.map(a => `${a.nome} ${a.sobrenome}`).join(', ')}`
            : '';

        return `
                <tr>
                    <td>
                        <div class="fw-bold">${c.nome} ${c.sobrenome}</div>
                        ${nomesAcompanhantes ? `<div class="small text-muted" style="max-width: 250px; white-space: normal;">${nomesAcompanhantes}</div>` : ''}
                    </td>
                    <td>${c.cpf || '<span class="text-muted">N/A</span>'}</td>
                    <td><span class="badge bg-secondary fs-6">Mesa ${c.numero_mesa}</span></td>
                    <td class="text-center text-nowrap">
                        <button class="btn ${entrou ? 'btn-secondary' : 'btn-success'} btn-sm" onclick="efetuarCheckin(${c.id_convidado}, this)" ${entrou ? 'disabled' : ''}>
                            ${entrou ? 'Entrada Registrada' : '<i class="bi bi-check2-circle"></i> Confirmar Entrada'}
                        </button>
                    </td>
                </tr>
            `;
    }).join('');
}

// Processamento do Check-in
async function efetuarCheckin(id_convidado, btn) {
    if (!currentUser) return;
    const htmlOrig = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Processando...';

    try {
        const res = await fetch(API_CHECKINS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id_usuario: currentUser.id_usuario || currentUser.id,
                id_convidado
            })
        });

        if (res.ok) {
            btn.classList.replace('btn-success', 'btn-secondary');
            btn.innerHTML = "Entrada Registrada";

            // Atualiza o estado "ja_entrou" no cache local para manter o botão correto ao pesquisar novamente
            const convidadoAtualizado = convidadosCache.find(c => c.id_convidado === id_convidado);
            if (convidadoAtualizado) convidadoAtualizado.ja_entrou = true;

            return;
        }

        if (res.status === 409) {
            btn.classList.replace('btn-success', 'btn-warning');
            btn.innerHTML = "Já efetuou check-in";
            return;
        }

        const result = await res.json();
        alert(result.erro || "Erro ao realizar check-in");
    } catch (error) {
        alert("Erro de comunicação com o servidor.");
    }

    // Se deu erro, restaura o botão original
    btn.disabled = false;
    btn.innerHTML = htmlOrig;
}

// ==========================================
// FUNÇÕES DE CADASTRO DO CERIMONIALISTA
// ==========================================

window.adicionarCampoAcompanhante = () => {
    document.getElementById('acompanhantes-container').insertAdjacentHTML('beforeend', `
            <div class="row mb-2 acompanhante-item align-items-center">
                <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-nome" placeholder="Nome" required></div>
                <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-sobrenome" placeholder="Apelido" required></div>
                <div class="col-md-2 text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.acompanhante-item').remove()" title="Remover"><i class="bi bi-trash"></i></button></div>
            </div>
        `);
};

async function cadastrarConvidado(e) {
    e.preventDefault();
    const msgDiv = document.getElementById('cadastro-msg');
    const showError = (msg) => (msgDiv.innerText = msg, msgDiv.className = 'text-danger text-center mt-2 d-block');
    msgDiv.className = 'd-none';

    const dados = {
        nome: document.getElementById('cad-nome').value,
        sobrenome: document.getElementById('cad-sobrenome').value,
        cpf: document.getElementById('cad-cpf').value,
        telefone: document.getElementById('cad-telefone').value,
        email: document.getElementById('cad-email').value,
        numero_mesa: document.getElementById('cad-mesa').value,
        acompanhantes: Array.from(document.querySelectorAll('.acompanhante-item')).map(el => ({
            nome: el.querySelector('.acomp-nome').value,
            sobrenome: el.querySelector('.acomp-sobrenome').value
        }))
    };

    try {
        const res = await fetch(API_CONVIDADOS, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!res.ok) return showError((await res.json()).erro || 'Erro ao criar convidado.');

        // Se der sucesso, volta a carregar os dados do servidor e fecha o modal
        carregarConvidados();
        bootstrap.Modal.getInstance(document.getElementById('modalNovoConvidado'))?.hide();
    } catch (error) {
        showError('Falha de comunicação com o servidor.');
    }
}