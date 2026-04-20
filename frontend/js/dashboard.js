let graficoInstance = null, convidadosCache = [], usuariosCache = [], mesasCache = [];
const API_USUARIOS = '/api/usuarios', API_MESAS = '/api/mesas';
// NOTA: API_CONVIDADOS removida das constantes locais para evitar erro de duplicação caso já exista noutro ficheiro.

// Helpers para otimização (renomeado de $ para byId para evitar conflitos com o jQuery)
const byId = id => document.getElementById(id);
const calcTotal = c => 1 + (c.acompanhantes?.length || 0);

document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    if (!user || user.perfil !== 'Admin') return window.location.href = '../index.html';
    if (typeof configurarNavbar === 'function') configurarNavbar('../index.html');

    // Carregamento Inicial
    carregarGraficoEstatisticas();
    carregarConvidadosAdmin();
    carregarUsuariosAdmin();
    carregarMesasAdmin();

    // Eventos Convidados
    byId('form-novo-convidado')?.addEventListener('submit', cadastrarConvidado);
    byId('modalNovoConvidado')?.addEventListener('hidden.bs.modal', () => {
        byId('form-novo-convidado').reset();
        byId('cad-id').value = '';
        byId('acompanhantes-container').innerHTML = '';
        byId('cadastro-msg').className = 'd-none';
        byId('modalNovoConvidadoLabel').innerText = "Cadastrar Novo Convidado";
        byId('btn-salvar-convidado').innerText = "Salvar Convidado";
    });

    byId('busca-dashboard')?.addEventListener('input', e => {
        const t = e.target.value.toLowerCase();
        document.querySelectorAll('#tabela-convidados-admin tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(t) ? '' : 'none');
    });

    // Eventos Usuários
    byId('form-novo-usuario')?.addEventListener('submit', salvarUsuario);
    byId('modalUsuario')?.addEventListener('hidden.bs.modal', () => {
        byId('form-novo-usuario').reset();
        byId('usu-id').value = '';
        byId('modalUsuarioLabel').innerText = "Novo Usuário";
        byId('usu-senha').placeholder = "Senha obrigatória para novos";
        byId('usu-senha').required = true;
    });

    // Eventos Mesas
    byId('form-nova-mesa')?.addEventListener('submit', salvarMesa);
    byId('modalMesa')?.addEventListener('hidden.bs.modal', () => {
        byId('form-nova-mesa').reset();
        byId('mesa-id').value = '';
        byId('modalMesaLabel').innerText = "Nova Mesa";
        byId('mesa-capacidade').value = '8';
        byId('mesa-msg').className = 'd-none';
    });
});

// ==========================================
// ESTATÍSTICAS E GRÁFICOS
// ==========================================
async function carregarGraficoEstatisticas() {
    try {
        const convidados = await fetch(API_CONVIDADOS).then(r => r.json());
        let t = 0, p = 0;

        convidados.forEach(c => {
            const totalNoGrupo = calcTotal(c);
            t += totalNoGrupo;
            if (c.ja_entrou) p += totalNoGrupo;
        });

        const a = Math.max(t - p, 0);
        byId('kpi-total').innerText = t;
        byId('kpi-presentes').innerText = p;
        byId('kpi-ausentes').innerText = a;
        byId('kpi-taxa').innerText = `${t > 0 ? Math.round((p / t) * 100) : 0}%`;

        const ctx = byId('graficoOcupacao')?.getContext('2d');
        if (!ctx) return;
        if (graficoInstance) graficoInstance.destroy();

        graficoInstance = new Chart(ctx, {
            type: 'doughnut',
            data: { labels: ['Presentes', 'Ausentes'], datasets: [{ data: [p, a], backgroundColor: ['#198754', '#dc3545'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }
        });
    } catch (error) { console.error("Erro estatísticas:", error); }
}

// ==========================================
// CRUD DE CONVIDADOS
// ==========================================
async function carregarConvidadosAdmin() {
    try {
        convidadosCache = await fetch(API_CONVIDADOS).then(r => r.json());
        if (!byId('tabela-convidados-admin')) return;

        byId('tabela-convidados-admin').innerHTML = convidadosCache.map(c => `
            <tr>
                <td>
                    <strong>${c.nome} ${c.sobrenome}</strong> <span class="badge bg-light text-dark border ms-1"><i class="bi bi-people-fill"></i> ${calcTotal(c)}</span>
                    ${c.acompanhantes?.length ? `<br><small class="text-muted"><i class="bi bi-arrow-return-right"></i> ${c.acompanhantes.map(a => `${a.nome} ${a.sobrenome}`).join(', ')}</small>` : ''}
                </td>
                <td class="text-nowrap">${c.cpf || 'N/A'}</td>
                <td class="text-nowrap">${c.telefone || 'N/A'}</td>
                <td><span class="badge ${c.numero_mesa ? 'bg-secondary' : 'bg-danger'}">${c.numero_mesa ? `Mesa ${c.numero_mesa}` : 'S/ Mesa'}</span></td>
                <td class="text-center text-nowrap">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirEdicao(${c.id_convidado})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusao(${c.id_convidado}, '${c.nome} ${c.sobrenome}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (error) { console.error("Erro convidados:", error); }
}

window.adicionarCampoAcompanhante = (dados = null) => {
    byId('acompanhantes-container').insertAdjacentHTML('beforeend', `
        <div class="row mb-2 acompanhante-item align-items-center">
            <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-nome" placeholder="Nome" required value="${dados?.nome || ''}"></div>
            <div class="col-md-5"><input type="text" class="form-control form-control-sm acomp-sobrenome" placeholder="Apelido" required value="${dados?.sobrenome || ''}"></div>
            <div class="col-md-2 text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.acompanhante-item').remove()"><i class="bi bi-trash"></i></button></div>
        </div>`);
};

window.abrirEdicao = (id) => {
    const c = convidadosCache.find(x => x.id_convidado === id);
    if (!c) return;

    ['id', 'nome', 'sobrenome', 'cpf', 'telefone', 'email', 'mesa'].forEach(k => {
        byId(`cad-${k}`).value = c[k === 'mesa' ? 'numero_mesa' : (k === 'id' ? 'id_convidado' : k)] || '';
    });

    byId('acompanhantes-container').innerHTML = '';
    c.acompanhantes?.forEach(adicionarCampoAcompanhante);

    byId('modalNovoConvidadoLabel').innerText = "Editar Convidado";
    byId('btn-salvar-convidado').innerText = "Atualizar Convidado";
    new bootstrap.Modal(byId('modalNovoConvidado')).show();
};

window.abrirExclusao = (id, nome) => {
    byId('id-excluir').value = id;
    byId('nome-excluir').innerText = nome;
    new bootstrap.Modal(byId('modalExcluirConvidado')).show();
};

window.excluirConvidado = async () => {
    try {
        if (!(await fetch(`${API_CONVIDADOS}/${byId('id-excluir').value}`, { method: 'DELETE' })).ok) return alert("Erro ao excluir.");
        carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin();
        bootstrap.Modal.getInstance(byId('modalExcluirConvidado'))?.hide();
    } catch (error) { console.error("Erro excluir:", error); }
};

async function cadastrarConvidado(e) {
    e.preventDefault();
    const msgDiv = byId('cadastro-msg'), idEdicao = byId('cad-id').value;
    const showError = msg => { msgDiv.innerText = msg; msgDiv.className = 'text-danger text-center mt-2 d-block'; };
    msgDiv.className = 'd-none';

    const dados = {
        nome: byId('cad-nome').value, sobrenome: byId('cad-sobrenome').value,
        cpf: byId('cad-cpf').value, telefone: byId('cad-telefone').value,
        email: byId('cad-email').value, numero_mesa: byId('cad-mesa').value,
        acompanhantes: Array.from(document.querySelectorAll('.acompanhante-item')).map(el => ({
            nome: el.querySelector('.acomp-nome').value,
            sobrenome: el.querySelector('.acomp-sobrenome').value
        }))
    };

    try {
        const res = await fetch(`${API_CONVIDADOS}${idEdicao ? `/${idEdicao}` : ''}`, {
            method: idEdicao ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        });

        if (!res.ok) return showError((await res.json()).erro || 'Erro na requisição.');
        carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin();
        bootstrap.Modal.getInstance(byId('modalNovoConvidado'))?.hide();
    } catch (error) { showError('Falha no servidor.'); }
}

// ==========================================
// CRUD DE MESAS
// ==========================================
async function carregarMesasAdmin() {
    try {
        mesasCache = await fetch(API_MESAS).then(r => r.json());
        if (!byId('tabela-mesas-admin')) return;

        byId('tabela-mesas-admin').innerHTML = mesasCache.map(m => `
            <tr>
                <td class="text-start"><strong>Mesa ${m.numero_mesa}</strong></td>
                <td>${m.capacidade}</td>
                <td><span class="badge ${m.ocupacao >= m.capacidade ? 'bg-danger' : (m.ocupacao > 0 ? 'bg-success' : 'bg-secondary')}">${m.ocupacao} / ${m.capacidade}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirEdicaoMesa(${m.id_mesa})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusaoMesa(${m.id_mesa}, 'Mesa ${m.numero_mesa}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (error) { console.error("Erro mesas:", error); }
}

window.abrirEdicaoMesa = (id) => {
    const m = mesasCache.find(x => x.id_mesa === id);
    if (!m) return;
    byId('mesa-id').value = m.id_mesa;
    byId('mesa-numero').value = m.numero_mesa;
    byId('mesa-capacidade').value = m.capacidade;
    byId('modalMesaLabel').innerText = "Editar Mesa";
    new bootstrap.Modal(byId('modalMesa')).show();
};

async function salvarMesa(e) {
    e.preventDefault();
    const id = byId('mesa-id').value, msgDiv = byId('mesa-msg');
    msgDiv.className = 'd-none';

    try {
        const res = await fetch(`${API_MESAS}${id ? `/${id}` : ''}`, {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ numero_mesa: byId('mesa-numero').value, capacidade: byId('mesa-capacidade').value })
        });

        if (!res.ok) {
            msgDiv.innerText = (await res.json()).erro;
            return msgDiv.className = 'text-danger small mt-2 d-block';
        }
        carregarMesasAdmin(); carregarConvidadosAdmin();
        bootstrap.Modal.getInstance(byId('modalMesa'))?.hide();
    } catch (error) {
        msgDiv.innerText = 'Erro no servidor.';
        msgDiv.className = 'text-danger small mt-2 d-block';
    }
}

window.abrirExclusaoMesa = (id, nome) => {
    byId('id-excluir-mesa').value = id;
    byId('numero-excluir-mesa').innerText = nome;
    new bootstrap.Modal(byId('modalExcluirMesa')).show();
};

window.excluirMesa = async () => {
    try {
        if (!(await fetch(`${API_MESAS}/${byId('id-excluir-mesa').value}`, { method: 'DELETE' })).ok) return alert("Erro ao excluir.");
        carregarMesasAdmin(); carregarConvidadosAdmin();
        bootstrap.Modal.getInstance(byId('modalExcluirMesa'))?.hide();
    } catch (error) { console.error(error); }
};

// ==========================================
// CRUD DE USUÁRIOS
// ==========================================
async function carregarUsuariosAdmin() {
    try {
        usuariosCache = await fetch(API_USUARIOS).then(r => r.json());
        if (!byId('tabela-usuarios-admin')) return;

        byId('tabela-usuarios-admin').innerHTML = usuariosCache.map(u => `
            <tr>
                <td><strong>${u.nome}</strong></td>
                <td class="text-nowrap">${u.cpf}</td>
                <td><span class="badge ${u.perfil === 'Admin' ? 'bg-primary' : 'bg-info text-dark'}">${u.perfil}</span></td>
                <td class="text-center text-nowrap">
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="alternarPerfilUsuario(${u.id_usuario}, '${u.perfil}')"><i class="bi bi-arrow-left-right"></i></button>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirEdicaoUsuario(${u.id_usuario})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusaoUsuario(${u.id_usuario}, '${u.nome}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (error) { console.error("Erro usuários:", error); }
}

window.alternarPerfilUsuario = async (id, perfil) => {
    const novoPerfil = perfil === 'Admin' ? 'Cerimonialista' : 'Admin';
    if (!confirm(`Alterar utilizador para ${novoPerfil}?`)) return;

    try {
        const res = await fetch(`${API_USUARIOS}/${id}/perfil`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perfil: novoPerfil }) });
        res.ok ? carregarUsuariosAdmin() : alert((await res.json()).erro || "Erro ao alterar.");
    } catch (error) { console.error(error); }
};

window.abrirEdicaoUsuario = (id) => {
    const u = usuariosCache.find(x => x.id_usuario === id);
    if (!u) return;
    byId('usu-id').value = u.id_usuario; byId('usu-nome').value = u.nome;
    byId('usu-cpf').value = u.cpf; byId('usu-email').value = u.email; byId('usu-perfil').value = u.perfil;
    byId('usu-senha').value = ''; byId('usu-senha').required = false; byId('usu-senha').placeholder = "Vazio para manter a atual";
    byId('modalUsuarioLabel').innerText = "Editar Usuário";
    new bootstrap.Modal(byId('modalUsuario')).show();
};

async function salvarUsuario(e) {
    e.preventDefault();
    const id = byId('usu-id').value, senha = byId('usu-senha').value;
    const dados = { nome: byId('usu-nome').value, cpf: byId('usu-cpf').value, email: byId('usu-email').value, perfil: byId('usu-perfil').value };
    if (senha) dados.senha = senha;

    try {
        const res = await fetch(`${API_USUARIOS}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dados) });
        if (!res.ok) return alert((await res.json()).erro || 'Erro ao guardar.');
        carregarUsuariosAdmin();
        bootstrap.Modal.getInstance(byId('modalUsuario'))?.hide();
    } catch (error) { alert('Falha no servidor.'); }
}

window.abrirExclusaoUsuario = (id, nome) => {
    byId('id-excluir-usu').value = id;
    byId('nome-excluir-usu').innerText = nome;
    new bootstrap.Modal(byId('modalExcluirUsuario')).show();
};

window.excluirUsuario = async () => {
    try {
        if (!(await fetch(`${API_USUARIOS}/${byId('id-excluir-usu').value}`, { method: 'DELETE' })).ok) return alert("Erro ao excluir.");
        carregarUsuariosAdmin();
        bootstrap.Modal.getInstance(byId('modalExcluirUsuario'))?.hide();
    } catch (error) { console.error(error); }
};

// ==========================================
// EXPORTAÇÃO E IMPORTAÇÃO
// ==========================================
const prepararExportacao = () => convidadosCache.map(c => ({
    Nome: c.nome, Sobrenome: c.sobrenome, CPF: c.cpf || '', Telefone: c.telefone || '', Email: c.email || '',
    Mesa: c.numero_mesa || '', Acompanhantes: c.acompanhantes?.map(a => `${a.nome} ${a.sobrenome}`).join(', ') || '',
    Status: c.ja_entrou ? 'Presente' : 'Ausente'
}));

window.exportarExcel = () => {
    if (!convidadosCache.length) return alert("Sem dados.");
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prepararExportacao()), "Convidados");
    XLSX.writeFile(wb, `WeddingPass_Convidados_${Date.now()}.xlsx`);
};

window.exportarCSV = () => {
    if (!convidadosCache.length) return alert("Sem dados.");
    const blob = new Blob(["\uFEFF" + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(prepararExportacao()))], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob); link.download = `WeddingPass_Convidados_${Date.now()}.csv`; link.click();
};

window.gerarPDF = () => {
    if (!convidadosCache.length) return alert("Sem dados.");
    let t = 0, p = 0;
    convidadosCache.forEach(c => { const tot = calcTotal(c); t += tot; if (c.ja_entrou) p += tot; });

    const doc = new window.jspdf.jsPDF();
    doc.setFontSize(20).setTextColor(214, 51, 132).text("Relatório de Convidados - Wedding Pass", 14, 20);
    doc.setFontSize(10).setTextColor(100).text(`Data: ${new Date().toLocaleString('pt-PT')}`, 14, 28);
    doc.setDrawColor(200).setFillColor(245, 245, 245).roundedRect(14, 35, 182, 25, 3, 3, 'FD');
    doc.setFontSize(11).setTextColor(0).text(`Total: ${t}`, 20, 42).text(`Compareceram: ${p}`, 20, 48).text(`Ausentes: ${t - p}`, 20, 54);
    doc.setFontSize(14).setTextColor(25, 135, 84).text(`${t > 0 ? ((p / t) * 100).toFixed(1) : 0}% de Presença`, 140, 50);

    doc.autoTable({
        head: [["Convidado e Grupo", "Mesa", "Status"]],
        body: convidadosCache.map(c => [`${c.nome} ${c.sobrenome}${c.acompanhantes?.length ? '\n' + c.acompanhantes.map(a => `- ${a.nome} ${a.sobrenome}`).join('\n') : ''}`, `Mesa ${c.numero_mesa}`, c.ja_entrou ? "PRESENTE" : "AUSENTE"]),
        startY: 65, theme: 'grid', headStyles: { fillColor: [214, 51, 132] },
        didParseCell: d => { if (d.section === 'body' && d.column.index === 2) d.cell.styles.textColor = d.cell.raw === "PRESENTE" ? [25, 135, 84] : [220, 53, 69]; }
    });

    const totPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totPages; i++) doc.setPage(i).setFontSize(8).setTextColor(150).text(`Página ${i} de ${totPages}`, 14, doc.internal.pageSize.height - 10);
    doc.save(`Relatorio_${Date.now()}.pdf`);
};

window.baixarModelo = () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{
        Nome: "Exemplo",
        Sobrenome: "Silva",
        CPF: "123.456.789-00",
        Telefone: "11999999999",
        Email: "ex@email.com",
        Mesa: 5,
        Acompanhantes: "Maria Silva, João Silva"
    }]), "Modelo");
    XLSX.writeFile(wb, "Modelo_WeddingPass.xlsx");
};

window.processarImportacao = async () => {
    const fileInput = byId('file-import'), msgDiv = byId('import-msg'), btn = byId('btn-processar-import');
    if (!fileInput.files.length) return alert('Selecione um arquivo.');

    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const jsonData = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!jsonData.length) return alert('Arquivo vazio ou inválido.');

        btn.disabled = true; msgDiv.className = 'text-primary fw-bold mt-2 d-block'; msgDiv.innerHTML = `<span class="spinner-border spinner-border-sm"></span> A processar ${jsonData.length} convidados...`;
        let sucessos = 0, erros = 0;

        for (const row of jsonData) {
            if (!row.Nome || !row.Sobrenome) { erros++; continue; }
            let acompanhantesTratados = [];
            if (row.Acompanhantes) String(row.Acompanhantes).split(',').forEach(n => {
                const p = n.trim().split(' ');
                if (p[0]) acompanhantesTratados.push({
                    nome: p[0],
                    sobrenome: p.slice(1).join(' ') || ''
                });
            });

            try {
                const body = JSON.stringify({
                    nome: String(row.Nome).trim(),
                    sobrenome: String(row.Sobrenome).trim(),
                    cpf: row.CPF ? String(row.CPF).trim() : null,
                    telefone: row.Telefone ? String(row.Telefone).trim() : null,
                    email: row.Email ? String(row.Email).trim() : null,
                    numero_mesa: row.Mesa ? Number(row.Mesa) : 1,
                    acompanhantes: acompanhantesTratados
                });
                (await fetch(API_CONVIDADOS,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body
                    })).ok ? sucessos++ : erros++;
            } catch (err) { erros++; }
        }

        btn.disabled = false; msgDiv.className = 'text-success fw-bold mt-2 d-block'; msgDiv.innerText = `Concluído! Sucessos: ${sucessos} | Falhas: ${erros}`;
        fileInput.value = ''; carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin();
        setTimeout(() => { bootstrap.Modal.getInstance(byId('modalImportar'))?.hide(); msgDiv.className = 'd-none'; }, 3000);
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
};