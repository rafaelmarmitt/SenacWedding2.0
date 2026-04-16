let currentUser = null;
let convidadosCache = [];
let chartInstance = null;

document.addEventListener("DOMContentLoaded", () => {
    currentUser = getUser();
    if (!currentUser || currentUser.perfil !== 'Admin') {
        window.location.href = '../index.html';
        return;
    }

    configurarNavbar('../index.html');
    carregarDashboard();

    document.getElementById('busca-dashboard')?.addEventListener('input', (e) => {
        renderizarTabela(e.target.value);
    });

    document.getElementById('form-novo-convidado')?.addEventListener('submit', salvarConvidado);

    document.getElementById('modalNovoConvidado')?.addEventListener('hidden.bs.modal', () => {
        document.getElementById('form-novo-convidado').reset();
        document.getElementById('cad-id').value = '';
        document.getElementById('acompanhantes-container').innerHTML = '';
        document.getElementById('cadastro-msg').className = 'd-none';
        document.getElementById('modalNovoConvidadoLabel').innerText = 'Cadastrar Novo Convidado';
        document.getElementById('btn-salvar-convidado').innerText = 'Salvar Convidado';
    });
});

async function carregarDashboard() {
    try {
        // Usamos as rotas monolíticas corretas
        const [resConvidados, resEstats] = await Promise.all([
            fetch(API_CONVIDADOS),
            fetch(`${API_CHECKINS}/estatisticas`)
        ]);

        convidadosCache = await resConvidados.json();
        const { presentes } = await resEstats.json();

        atualizarKPIs(presentes);
        renderizarTabela('');
    } catch (error) {
        console.error("Erro ao carregar dashboard:", error);
    }
}

function atualizarKPIs(presentes) {
    let totalEsperado = 0;

    convidadosCache.forEach(c => {
        totalEsperado += 1; // O convidado principal
        if (c.acompanhantes) totalEsperado += c.acompanhantes.length; // Os acompanhantes
    });

    const ausentes = totalEsperado - presentes;
    const taxa = totalEsperado > 0 ? ((presentes / totalEsperado) * 100).toFixed(1) : 0;

    document.getElementById('kpi-total').innerText = totalEsperado;
    document.getElementById('kpi-presentes').innerText = presentes;
    document.getElementById('kpi-ausentes').innerText = ausentes;
    document.getElementById('kpi-taxa').innerText = `${taxa}%`;

    renderizarGrafico(presentes, ausentes);
}

function renderizarGrafico(presentes, ausentes) {
    const ctx = document.getElementById('graficoOcupacao');
    if (!ctx) return;

    if (chartInstance) chartInstance.destroy();

    chartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Presentes', 'Ausentes'],
            datasets: [{
                data: [presentes, ausentes],
                backgroundColor: ['#198754', '#ffc107'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'bottom' }
            }
        }
    });
}

function renderizarTabela(filtro) {
    const tbody = document.getElementById('tabela-convidados-admin');
    if (!tbody) return;

    const termo = filtro.toLowerCase();
    const filtrados = convidadosCache.filter(c =>
        c.nome.toLowerCase().includes(termo) ||
        c.sobrenome.toLowerCase().includes(termo) ||
        (c.cpf && c.cpf.includes(termo))
    );

    if (filtrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center text-muted py-4">Nenhum convidado encontrado.</td></tr>`;
        return;
    }

    tbody.innerHTML = filtrados.map(c => {
        // Formata a exibição dos acompanhantes listando os nomes
        const nomesAcompanhantes = c.acompanhantes && c.acompanhantes.length > 0
            ? `<i class="bi bi-people-fill"></i> ${c.acompanhantes.map(a => `${a.nome} ${a.sobrenome}`).join(', ')}`
            : 'Nenhum acompanhante';

        return `
        <tr>
            <td>
                <div class="fw-bold">${c.nome} ${c.sobrenome}</div>
                <div class="small text-muted" style="max-width: 250px; white-space: normal;">${nomesAcompanhantes}</div>
            </td>
            <td>${c.cpf || '<span class="text-muted">N/A</span>'}</td>
            <td>${c.telefone || '<span class="text-muted">N/A</span>'}</td>
            <td><span class="badge bg-secondary">Mesa ${c.numero_mesa}</span></td>
            <td class="text-center text-nowrap">
                <button class="btn btn-sm btn-outline-primary me-1" onclick='abrirModalEdicao(${JSON.stringify(c).replace(/'/g, "&#39;")})' title="Editar"><i class="bi bi-pencil"></i></button>
                <button class="btn btn-sm btn-outline-danger" onclick="abrirModalExclusao(${c.id_convidado}, '${c.nome} ${c.sobrenome}')" title="Excluir"><i class="bi bi-trash"></i></button>
            </td>
        </tr>
        `;
    }).join('');
}

window.adicionarCampoAcompanhante = (nome = '', sobrenome = '') => {
    document.getElementById('acompanhantes-container').insertAdjacentHTML('beforeend', `
        <div class="row mb-2 acompanhante-item align-items-center">
            <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-nome" placeholder="Nome" value="${nome}" required></div>
            <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-sobrenome" placeholder="Apelido" value="${sobrenome}" required></div>
            <div class="col-md-2 text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.acompanhante-item').remove()" title="Remover"><i class="bi bi-trash"></i></button></div>
        </div>
    `);
};

window.abrirModalEdicao = (convidado) => {
    document.getElementById('modalNovoConvidadoLabel').innerText = 'Editar Convidado';
    document.getElementById('btn-salvar-convidado').innerText = 'Atualizar Convidado';
    document.getElementById('cad-id').value = convidado.id_convidado;
    document.getElementById('cad-nome').value = convidado.nome;
    document.getElementById('cad-sobrenome').value = convidado.sobrenome;
    document.getElementById('cad-cpf').value = convidado.cpf || '';
    document.getElementById('cad-telefone').value = convidado.telefone || '';
    document.getElementById('cad-email').value = convidado.email || '';
    document.getElementById('cad-mesa').value = convidado.numero_mesa;

    document.getElementById('acompanhantes-container').innerHTML = '';
    if (convidado.acompanhantes) {
        convidado.acompanhantes.forEach(a => adicionarCampoAcompanhante(a.nome, a.sobrenome));
    }

    new bootstrap.Modal(document.getElementById('modalNovoConvidado')).show();
};

async function salvarConvidado(e) {
    e.preventDefault();
    const id = document.getElementById('cad-id').value;
    const msgDiv = document.getElementById('cadastro-msg');

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

    const metodo = id ? 'PUT' : 'POST';
    const url = id ? `${API_CONVIDADOS}/${id}` : API_CONVIDADOS;

    try {
        const res = await fetch(url, {
            method: metodo,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!res.ok) {
            const err = await res.json();
            msgDiv.innerText = err.erro || 'Erro ao guardar convidado.';
            msgDiv.className = 'text-danger text-center mt-2 d-block';
            return;
        }

        bootstrap.Modal.getInstance(document.getElementById('modalNovoConvidado')).hide();
        carregarDashboard(); // Recarrega os dados
    } catch (error) {
        msgDiv.innerText = 'Falha de comunicação com o servidor.';
        msgDiv.className = 'text-danger text-center mt-2 d-block';
    }
}

window.abrirModalExclusao = (id, nome) => {
    document.getElementById('id-excluir').value = id;
    document.getElementById('nome-excluir').innerText = nome;
    new bootstrap.Modal(document.getElementById('modalExcluirConvidado')).show();
};

window.excluirConvidado = async () => {
    const id = document.getElementById('id-excluir').value;
    try {
        const res = await fetch(`${API_CONVIDADOS}/${id}`, { method: 'DELETE' });
        if (res.ok) {
            bootstrap.Modal.getInstance(document.getElementById('modalExcluirConvidado')).hide();
            carregarDashboard();
        } else {
            alert((await res.json()).erro || 'Erro ao excluir.');
        }
    } catch (error) {
        alert('Erro de comunicação com o servidor.');
    }
};

// Função para Gerar PDF (mantida e atualizada para a nova API)
window.gerarPDF = () => {
    if (!convidadosCache.length) return alert("Sem dados para exportar.");
    const doc = new window.jspdf.jsPDF();
    const t = convidadosCache.length;

    // Verifica a propriedade ja_entrou (compatível com o novo MySQL)
    const p = convidadosCache.filter(c => c.ja_entrou === 1 || c.ja_entrou === true).length;

    doc.setFontSize(20).setTextColor(214, 51, 132).text("Relatório de Convidados - Wedding Pass", 14, 20);
    doc.setFontSize(10).setTextColor(100).text(`Data do Relatório: ${new Date().toLocaleString('pt-PT')}`, 14, 28);

    doc.setDrawColor(200).setFillColor(245, 245, 245).roundedRect(14, 35, 182, 25, 3, 3, 'FD');
    doc.setFontSize(11).setTextColor(0).text(`Total: ${t}`, 20, 42).text(`Compareceram: ${p}`, 20, 48).text(`Ausentes: ${t - p}`, 20, 54);
    doc.setFontSize(14).setTextColor(25, 135, 84).text(`${t > 0 ? ((p / t) * 100).toFixed(1) : 0}% de Presença`, 140, 50);

    doc.autoTable({
        head: [["Convidado (e Acompanhantes)", "Mesa", "Status"]],
        body: convidadosCache.map(c => [
            `${c.nome} ${c.sobrenome}${c.acompanhantes?.length ? '\n' + c.acompanhantes.map(a => `- ${a.nome} ${a.sobrenome}`).join('\n') : ''}`,
            `Mesa ${c.numero_mesa}`,
            (c.ja_entrou === 1 || c.ja_entrou === true) ? "PRESENTE" : "AUSENTE"
        ]),
        startY: 65, theme: 'grid', headStyles: { fillColor: [214, 51, 132], halign: 'center' }, columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' } },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index === 2) d.cell.styles.textColor = d.cell.raw === "PRESENTE" ? [25, 135, 84] : [220, 53, 69]; },
        styles: { fontSize: 9, cellPadding: 3 }
    });

    for (let i = 1, total = doc.internal.getNumberOfPages(); i <= total; i++) {
        doc.setPage(i).setFontSize(8).setTextColor(150).text(`Página ${i} de ${total} - Wedding Pass`, 14, doc.internal.pageSize.height - 10);
    }
    doc.save(`WeddingPass_Relatorio_${Date.now()}.pdf`);
};