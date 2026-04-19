let graficoInstance = null, convidadosCache = [];
let usuariosCache = [], mesasCache = [];
const API_USUARIOS = '/api/usuarios';
const API_MESAS = '/api/mesas';

// Inicializa a página e valida acessos
document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    if (!user || user.perfil !== 'Admin') return window.location.href = '../index.html';

    if (typeof configurarNavbar === 'function') configurarNavbar('../index.html');

    // Carrega dados Iniciais
    carregarGraficoEstatisticas();
    carregarConvidadosAdmin();
    carregarUsuariosAdmin();
    carregarMesasAdmin(); // Carrega a nova tabela de Mesas

    // Eventos Convidados
    document.getElementById('form-novo-convidado')?.addEventListener('submit', cadastrarConvidado);
    document.getElementById('modalNovoConvidado')?.addEventListener('hidden.bs.modal', () => {
        document.getElementById('form-novo-convidado').reset();
        document.getElementById('cad-id').value = '';
        document.getElementById('acompanhantes-container').innerHTML = '';
        document.getElementById('cadastro-msg').className = 'd-none';
        document.getElementById('modalNovoConvidadoLabel').innerText = "Cadastrar Novo Convidado";
        document.getElementById('btn-salvar-convidado').innerText = "Salvar Convidado";
    });

    document.getElementById('busca-dashboard')?.addEventListener('input', e => {
        const t = e.target.value.toLowerCase();
        document.querySelectorAll('#tabela-convidados-admin tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(t) ? '' : 'none');
    });

    // Eventos Usuários
    document.getElementById('form-novo-usuario')?.addEventListener('submit', salvarUsuario);
    document.getElementById('modalUsuario')?.addEventListener('hidden.bs.modal', () => {
        document.getElementById('form-novo-usuario').reset();
        document.getElementById('usu-id').value = '';
        document.getElementById('modalUsuarioLabel').innerText = "Novo Usuário";
        document.getElementById('usu-senha').placeholder = "Senha obrigatória para novos";
        document.getElementById('usu-senha').required = true;
    });

    // Eventos Mesas
    document.getElementById('form-nova-mesa')?.addEventListener('submit', salvarMesa);
    document.getElementById('modalMesa')?.addEventListener('hidden.bs.modal', () => {
        document.getElementById('form-nova-mesa').reset();
        document.getElementById('mesa-id').value = '';
        document.getElementById('modalMesaLabel').innerText = "Nova Mesa";
        document.getElementById('mesa-capacidade').value = '8';
        document.getElementById('mesa-msg').className = 'd-none';
    });
});

// ==========================================
// ESTATÍSTICAS E GRÁFICOS
// ==========================================
async function carregarGraficoEstatisticas() {
    try {
        const convidados = await fetch(API_CONVIDADOS).then(r => r.json());

        const t = convidados.length;
        const p = convidados.filter(c => c.ja_entrou === 1 || c.ja_entrou === true).length;
        const a = Math.max(t - p, 0);

        document.getElementById('kpi-total').innerText = t;
        document.getElementById('kpi-presentes').innerText = p;
        document.getElementById('kpi-ausentes').innerText = a;
        document.getElementById('kpi-taxa').innerText = `${t > 0 ? Math.round((p / t) * 100) : 0}%`;

        const ctx = document.getElementById('graficoOcupacao')?.getContext('2d');
        if (!ctx) return;
        if (graficoInstance) graficoInstance.destroy();

        graficoInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Presentes', 'Ausentes'], datasets: [{ data: [p, a], backgroundColor: ['#198754', '#dc3545'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    } catch (error) { console.error("Erro nas estatísticas:", error); }
}

// ==========================================
// CRUD DE CONVIDADOS
// ==========================================
async function carregarConvidadosAdmin() {
    try {
        convidadosCache = await fetch(API_CONVIDADOS).then(r => r.json());
        const tbody = document.getElementById('tabela-convidados-admin');
        if (!tbody) return;

        tbody.innerHTML = convidadosCache.map(c => `
            <tr>
                <td><strong>${c.nome} ${c.sobrenome}</strong>${c.acompanhantes?.length ? `<br><small class="text-muted"><i class="bi bi-people-fill"></i> ${c.acompanhantes.map(a => `${a.nome} ${a.sobrenome}`).join(', ')}</small>` : ''}</td>
                <td class="text-nowrap">${c.cpf || 'N/A'}</td>
                <td class="text-nowrap">${c.telefone || 'N/A'}</td>
                <td><span class="badge ${c.numero_mesa ? 'bg-secondary' : 'bg-danger'}">${c.numero_mesa ? `Mesa ${c.numero_mesa}` : 'S/ Mesa'}</span></td>
                <td class="text-center text-nowrap">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirEdicao(${c.id_convidado})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusao(${c.id_convidado}, '${c.nome} ${c.sobrenome}')" title="Excluir"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (error) { console.error("Erro ao carregar convidados:", error); }
}

window.adicionarCampoAcompanhante = (dados = null) => {
    document.getElementById('acompanhantes-container').insertAdjacentHTML('beforeend', `
        <div class="row mb-2 acompanhante-item align-items-center">
            <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-nome" placeholder="Nome" required value="${dados?.nome || ''}"></div>
            <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-sobrenome" placeholder="Apelido" required value="${dados?.sobrenome || ''}"></div>
            <div class="col-md-2 text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.acompanhante-item').remove()" title="Remover"><i class="bi bi-trash"></i></button></div>
        </div>
    `);
};

window.abrirEdicao = (id) => {
    const c = convidadosCache.find(x => x.id_convidado === id);
    if (!c) return;

    ['id', 'nome', 'sobrenome', 'cpf', 'telefone', 'email', 'mesa'].forEach(k => {
        const propDb = k === 'mesa' ? 'numero_mesa' : (k === 'id' ? 'id_convidado' : k);
        document.getElementById(`cad-${k}`).value = c[propDb] || '';
    });

    document.getElementById('acompanhantes-container').innerHTML = '';
    c.acompanhantes?.forEach(adicionarCampoAcompanhante);

    document.getElementById('modalNovoConvidadoLabel').innerText = "Editar Convidado";
    document.getElementById('btn-salvar-convidado').innerText = "Atualizar Convidado";
    new bootstrap.Modal(document.getElementById('modalNovoConvidado')).show();
};

window.abrirExclusao = (id, nomeCompleto) => {
    document.getElementById('id-excluir').value = id;
    document.getElementById('nome-excluir').innerText = nomeCompleto;
    new bootstrap.Modal(document.getElementById('modalExcluirConvidado')).show();
};

window.excluirConvidado = async () => {
    try {
        const res = await fetch(`${API_CONVIDADOS}/${document.getElementById('id-excluir').value}`, { method: 'DELETE' });
        if (!res.ok) return alert("Erro ao excluir o convidado.");
        carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin();
        bootstrap.Modal.getInstance(document.getElementById('modalExcluirConvidado'))?.hide();
    } catch (error) { console.error("Erro ao excluir:", error); }
};

async function cadastrarConvidado(e) {
    e.preventDefault();
    const msgDiv = document.getElementById('cadastro-msg'), idEdicao = document.getElementById('cad-id').value;
    const showError = (msg) => (msgDiv.innerText = msg, msgDiv.className = 'text-danger text-center mt-2 d-block');
    msgDiv.className = 'd-none';

    const dados = {
        nome: document.getElementById('cad-nome').value, sobrenome: document.getElementById('cad-sobrenome').value,
        cpf: document.getElementById('cad-cpf').value, telefone: document.getElementById('cad-telefone').value,
        email: document.getElementById('cad-email').value, numero_mesa: document.getElementById('cad-mesa').value,
        acompanhantes: Array.from(document.querySelectorAll('.acompanhante-item')).map(el => ({ nome: el.querySelector('.acomp-nome').value, sobrenome: el.querySelector('.acomp-sobrenome').value }))
    };

    try {
        const res = await fetch(`${API_CONVIDADOS}${idEdicao ? `/${idEdicao}` : ''}`, { method: idEdicao ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
        if (!res.ok) return showError((await res.json()).erro || 'Erro ao processar a requisição.');

        carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin();
        bootstrap.Modal.getInstance(document.getElementById('modalNovoConvidado'))?.hide();
    } catch (error) { showError('Falha de comunicação com o servidor.'); }
}

// ==========================================
// CRUD DE MESAS
// ==========================================
async function carregarMesasAdmin() {
    try {
        mesasCache = await fetch(API_MESAS).then(r => r.json());
        const tbody = document.getElementById('tabela-mesas-admin');
        if (!tbody) return;

        tbody.innerHTML = mesasCache.map(m => {
            const atingiuLimite = m.ocupacao >= m.capacidade;
            const badgeClasse = atingiuLimite ? 'bg-danger' : (m.ocupacao > 0 ? 'bg-success' : 'bg-secondary');
            return `
            <tr>
                <td class="text-start"><strong>Mesa ${m.numero_mesa}</strong></td>
                <td>${m.capacidade}</td>
                <td><span class="badge ${badgeClasse}">${m.ocupacao} / ${m.capacidade}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirEdicaoMesa(${m.id_mesa})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusaoMesa(${m.id_mesa}, 'Mesa ${m.numero_mesa}')" title="Excluir"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `}).join('');
    } catch (error) { console.error("Erro ao carregar mesas:", error); }
}

window.abrirEdicaoMesa = (id) => {
    const m = mesasCache.find(x => x.id_mesa === id);
    if (!m) return;
    document.getElementById('mesa-id').value = m.id_mesa;
    document.getElementById('mesa-numero').value = m.numero_mesa;
    document.getElementById('mesa-capacidade').value = m.capacidade;
    document.getElementById('modalMesaLabel').innerText = "Editar Mesa";
    new bootstrap.Modal(document.getElementById('modalMesa')).show();
};

async function salvarMesa(e) {
    e.preventDefault();
    const id = document.getElementById('mesa-id').value;
    const msgDiv = document.getElementById('mesa-msg');
    msgDiv.className = 'd-none';

    const dados = {
        numero_mesa: document.getElementById('mesa-numero').value,
        capacidade: document.getElementById('mesa-capacidade').value
    };

    try {
        const res = await fetch(`${API_MESAS}${id ? `/${id}` : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!res.ok) {
            msgDiv.innerText = (await res.json()).erro;
            msgDiv.className = 'text-danger small mt-2 d-block';
            return;
        }

        carregarMesasAdmin();
        carregarConvidadosAdmin(); // Porque o número da mesa pode ter mudado
        bootstrap.Modal.getInstance(document.getElementById('modalMesa'))?.hide();
    } catch (error) {
        msgDiv.innerText = 'Erro ao comunicar com o servidor.';
        msgDiv.className = 'text-danger small mt-2 d-block';
    }
}

window.abrirExclusaoMesa = (id, nome) => {
    document.getElementById('id-excluir-mesa').value = id;
    document.getElementById('numero-excluir-mesa').innerText = nome;
    new bootstrap.Modal(document.getElementById('modalExcluirMesa')).show();
};

window.excluirMesa = async () => {
    try {
        const id = document.getElementById('id-excluir-mesa').value;
        const res = await fetch(`${API_MESAS}/${id}`, { method: 'DELETE' });
        if (!res.ok) return alert("Erro ao excluir mesa.");

        carregarMesasAdmin();
        carregarConvidadosAdmin(); // Atualiza a tabela porque os convidados desta mesa ficarão "Sem mesa"
        bootstrap.Modal.getInstance(document.getElementById('modalExcluirMesa'))?.hide();
    } catch (error) { console.error(error); }
};

// ==========================================
// CRUD DE USUÁRIOS
// ==========================================
async function carregarUsuariosAdmin() {
    try {
        usuariosCache = await fetch(API_USUARIOS).then(r => r.json());
        const tbody = document.getElementById('tabela-usuarios-admin');
        if (!tbody) return;

        tbody.innerHTML = usuariosCache.map(u => `
            <tr>
                <td><strong>${u.nome}</strong></td>
                <td class="text-nowrap">${u.cpf}</td>
                <td><span class="badge ${u.perfil === 'Admin' ? 'bg-primary' : 'bg-info text-dark'}">${u.perfil}</span></td>
                <td class="text-center text-nowrap">
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="alternarPerfilUsuario(${u.id_usuario}, '${u.perfil}')" title="Alternar Perfil"><i class="bi bi-arrow-left-right"></i></button>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirEdicaoUsuario(${u.id_usuario})" title="Editar"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusaoUsuario(${u.id_usuario}, '${u.nome}')" title="Excluir"><i class="bi bi-trash"></i></button>
                </td>
            </tr>
        `).join('');
    } catch (error) { console.error("Erro ao carregar usuários:", error); }
}

window.alternarPerfilUsuario = async (id, perfilAtual) => {
    const novoPerfil = perfilAtual === 'Admin' ? 'Cerimonialista' : 'Admin';
    if (!confirm(`Deseja alterar o perfil deste utilizador para ${novoPerfil}?`)) return;

    try {
        const res = await fetch(`${API_USUARIOS}/${id}/perfil`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: novoPerfil }) });
        if (res.ok) carregarUsuariosAdmin(); else alert((await res.json()).erro || "Erro ao alterar perfil.");
    } catch (error) { console.error(error); }
};

window.abrirEdicaoUsuario = (id) => {
    const u = usuariosCache.find(x => x.id_usuario === id);
    if (!u) return;
    document.getElementById('usu-id').value = u.id_usuario;
    document.getElementById('usu-nome').value = u.nome;
    document.getElementById('usu-cpf').value = u.cpf;
    document.getElementById('usu-email').value = u.email;
    document.getElementById('usu-perfil').value = u.perfil;
    document.getElementById('usu-senha').value = '';
    document.getElementById('usu-senha').required = false;
    document.getElementById('usu-senha').placeholder = "Deixe em branco para manter a atual";
    document.getElementById('modalUsuarioLabel').innerText = "Editar Usuário";
    new bootstrap.Modal(document.getElementById('modalUsuario')).show();
};

async function salvarUsuario(e) {
    e.preventDefault();
    const id = document.getElementById('usu-id').value;
    const dados = { nome: document.getElementById('usu-nome').value, cpf: document.getElementById('usu-cpf').value, email: document.getElementById('usu-email').value, perfil: document.getElementById('usu-perfil').value };
    const senha = document.getElementById('usu-senha').value;
    if (senha) dados.senha = senha;

    try {
        const res = await fetch(`${API_USUARIOS}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
        if (!res.ok) return alert((await res.json()).erro || 'Erro ao guardar utilizador.');
        carregarUsuariosAdmin();
        bootstrap.Modal.getInstance(document.getElementById('modalUsuario'))?.hide();
    } catch (error) { alert('Falha de comunicação com o servidor.'); }
}

window.abrirExclusaoUsuario = (id, nome) => {
    document.getElementById('id-excluir-usu').value = id;
    document.getElementById('nome-excluir-usu').innerText = nome;
    new bootstrap.Modal(document.getElementById('modalExcluirUsuario')).show();
};

window.excluirUsuario = async () => {
    try {
        const id = document.getElementById('id-excluir-usu').value;
        const res = await fetch(`${API_USUARIOS}/${id}`, { method: 'DELETE' });
        if (!res.ok) return alert("Erro ao excluir o utilizador.");
        carregarUsuariosAdmin();
        bootstrap.Modal.getInstance(document.getElementById('modalExcluirUsuario'))?.hide();
    } catch (error) { console.error(error); }
};

// ==========================================
// FUNÇÕES DE EXPORTAÇÃO E IMPORTAÇÃO
// ==========================================
function prepararDadosExportacao() {
    return convidadosCache.map(c => ({
        'Nome': c.nome, 'Sobrenome': c.sobrenome, 'CPF': c.cpf || '', 'Telefone': c.telefone || '',
        'Email': c.email || '', 'Mesa': c.numero_mesa || '', 'Acompanhantes': c.acompanhantes?.map(a => `${a.nome} ${a.sobrenome}`).join(', ') || '',
        'Status': c.ja_entrou ? 'Presente' : 'Ausente'
    }));
}

window.exportarExcel = () => {
    if (!convidadosCache.length) return alert("Sem dados para exportar.");
    const ws = XLSX.utils.json_to_sheet(prepararDadosExportacao()), wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Convidados");
    XLSX.writeFile(wb, `WeddingPass_Convidados_${Date.now()}.xlsx`);
};

window.exportarCSV = () => {
    if (!convidadosCache.length) return alert("Sem dados para exportar.");
    const csv = XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(prepararDadosExportacao()));
    const blob = new Blob(["\uFEFF" + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `WeddingPass_Convidados_${Date.now()}.csv`;
    link.click();
};

window.gerarPDF = () => {
    if (!convidadosCache.length) return alert("Sem dados para exportar.");
    const doc = new window.jspdf.jsPDF(), t = convidadosCache.length, p = convidadosCache.filter(c => c.ja_entrou).length;
    doc.setFontSize(20).setTextColor(214, 51, 132).text("Relatório de Convidados - Wedding Pass", 14, 20);
    doc.setFontSize(10).setTextColor(100).text(`Data do Relatório: ${new Date().toLocaleString('pt-PT')}`, 14, 28);
    doc.setDrawColor(200).setFillColor(245, 245, 245).roundedRect(14, 35, 182, 25, 3, 3, 'FD');
    doc.setFontSize(11).setTextColor(0).text(`Total: ${t}`, 20, 42).text(`Compareceram: ${p}`, 20, 48).text(`Ausentes: ${t - p}`, 20, 54);
    doc.setFontSize(14).setTextColor(25, 135, 84).text(`${t > 0 ? ((p / t) * 100).toFixed(1) : 0}% de Presença`, 140, 50);

    doc.autoTable({
        head: [["Convidado", "Mesa", "Status"]],
        body: convidadosCache.map(c => [`${c.nome} ${c.sobrenome}${c.acompanhantes?.length ? '\n' + c.acompanhantes.map(a => `- ${a.nome} ${a.sobrenome}`).join('\n') : ''}`, `Mesa ${c.numero_mesa}`, c.ja_entrou ? "PRESENTE" : "AUSENTE"]),
        startY: 65, theme: 'grid', headStyles: { fillColor: [214, 51, 132], halign: 'center' }, columnStyles: { 0: { cellWidth: 100 }, 1: { halign: 'center' }, 2: { halign: 'center', fontStyle: 'bold' } },
        didParseCell: (d) => { if (d.section === 'body' && d.column.index === 2) d.cell.styles.textColor = d.cell.raw === "PRESENTE" ? [25, 135, 84] : [220, 53, 69]; },
        styles: { fontSize: 9, cellPadding: 3 }
    });
    for (let i = 1, total = doc.internal.getNumberOfPages(); i <= total; i++) doc.setPage(i).setFontSize(8).setTextColor(150).text(`Página ${i} de ${total} - Wedding Pass`, 14, doc.internal.pageSize.height - 10);
    doc.save(`WeddingPass_Relatorio_${Date.now()}.pdf`);
};

window.baixarModelo = () => {
    const ws = XLSX.utils.json_to_sheet([{ "Nome": "Exemplo", "Sobrenome": "Silva", "CPF": "123.456.789-00", "Telefone": "11999999999", "Email": "exemplo@email.com", "Mesa": 5, "Acompanhantes": "Maria Silva, João Silva" }]);
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Modelo_Importacao"); XLSX.writeFile(wb, "Modelo_WeddingPass.xlsx");
};

window.processarImportacao = async () => {
    const fileInput = document.getElementById('file-import'), msgDiv = document.getElementById('import-msg'), btn = document.getElementById('btn-processar-import');
    if (!fileInput.files.length) return alert('Por favor, selecione um arquivo primeiro.');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const workbook = XLSX.read(new Uint8Array(e.target.result), { type: 'array' }), jsonData = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        if (!jsonData.length) return alert('O arquivo parece estar vazio ou tem um formato inválido.');

        btn.disabled = true; msgDiv.className = 'text-primary fw-bold mt-2 d-block'; msgDiv.innerHTML = `<span class="spinner-border spinner-border-sm"></span> A processar ${jsonData.length} convidados...`;
        let sucessos = 0, erros = 0;

        for (const row of jsonData) {
            if (!row.Nome || !row.Sobrenome) { erros++; continue; }
            let acompanhantesTratados = [];
            if (row.Acompanhantes) String(row.Acompanhantes).split(',').forEach(n => { const p = n.trim().split(' '); if (p.length > 0 && p[0]) acompanhantesTratados.push({ nome: p[0], sobrenome: p.slice(1).join(' ') || '' }); });

            try {
                const res = await fetch(API_CONVIDADOS, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: String(row.Nome).trim(), sobrenome: String(row.Sobrenome).trim(), cpf: row.CPF ? String(row.CPF).trim() : null, telefone: row.Telefone ? String(row.Telefone).trim() : null, email: row.Email ? String(row.Email).trim() : null, numero_mesa: row.Mesa ? Number(row.Mesa) : 1, acompanhantes: acompanhantesTratados }) });
                res.ok ? sucessos++ : erros++;
            } catch (err) { erros++; }
        }

        btn.disabled = false; msgDiv.className = 'text-success fw-bold mt-2 d-block'; msgDiv.innerText = `Importação concluída! Sucessos: ${sucessos} | Falhas: ${erros}`;
        fileInput.value = ''; carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin();
        setTimeout(() => { bootstrap.Modal.getInstance(document.getElementById('modalImportar'))?.hide(); msgDiv.className = 'd-none'; }, 3000);
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
};