let graficoInstance = null, convidadosCache = [], usuariosCache = [], mesasCache = [];
const API_USUARIOS = '/api/usuarios', API_MESAS = '/api/mesas';

const byId = id => document.getElementById(id);
const calcTotal = c => 1 + (c.acompanhantes?.length || 0);
const fecharModal = id => bootstrap.Modal.getInstance(byId(id))?.hide();

// Auxiliar supremo para requisições API (elimina repetição de fetch, JSON e try/catch isolados)
const req = async (url, method = 'GET', body = null) => {
    const res = await fetch(url, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined
    });
    if (!res.ok) throw await res.json().catch(() => ({ erro: 'Erro no servidor' }));
    return method === 'GET' ? res.json() : res;
};

document.addEventListener("DOMContentLoaded", () => {
    const user = getUser();
    if (!user || user.perfil !== 'Admin') return window.location.href = '../index.html';
    if (typeof configurarNavbar === 'function') configurarNavbar('../index.html');

    carregarGraficoEstatisticas(); carregarConvidadosAdmin(); carregarUsuariosAdmin(); carregarMesasAdmin();

    byId('form-novo-convidado')?.addEventListener('submit', cadastrarConvidado);
    byId('modalNovoConvidado')?.addEventListener('hidden.bs.modal', () => {
        byId('form-novo-convidado').reset(); byId('cad-id').value = ''; byId('acompanhantes-container').innerHTML = '';
        byId('cadastro-msg').className = 'd-none'; byId('modalNovoConvidadoLabel').innerText = "Cadastrar Novo Convidado";
    });

    byId('busca-dashboard')?.addEventListener('input', e => {
        const t = e.target.value.toLowerCase();
        document.querySelectorAll('#tabela-convidados-admin tr').forEach(r => r.style.display = r.innerText.toLowerCase().includes(t) ? '' : 'none');
    });

    byId('form-novo-usuario')?.addEventListener('submit', salvarUsuario);
    byId('modalUsuario')?.addEventListener('hidden.bs.modal', () => {
        byId('form-novo-usuario').reset(); byId('usu-id').value = ''; byId('modalUsuarioLabel').innerText = "Novo Usuário";
        byId('usu-senha').placeholder = "Senha obrigatória"; byId('usu-senha').required = true;
    });

    byId('form-nova-mesa')?.addEventListener('submit', salvarMesa);
    byId('modalMesa')?.addEventListener('hidden.bs.modal', () => {
        byId('form-nova-mesa').reset(); byId('mesa-id').value = ''; byId('modalMesaLabel').innerText = "Nova Mesa";
        byId('mesa-capacidade').value = '8'; byId('mesa-msg').className = 'd-none';
    });
});

async function carregarGraficoEstatisticas() {
    try {
        const convidados = await req(API_CONVIDADOS);
        let t = 0, p = 0;

        convidados.forEach(c => {
            const tot = calcTotal(c); t += tot; if (c.ja_entrou) p += tot;
        });

        byId('kpi-total').innerText = t; byId('kpi-presentes').innerText = p; byId('kpi-ausentes').innerText = Math.max(t - p, 0);
        byId('kpi-taxa').innerText = `${t > 0 ? Math.round((p / t) * 100) : 0}%`;

        const ctx = byId('graficoOcupacao')?.getContext('2d');
        if (!ctx) return;
        if (graficoInstance) graficoInstance.destroy();

        graficoInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ['Presentes', 'Ausentes'],
                datasets: [{
                    data: [p, Math.max(t - p, 0)],
                    backgroundColor: ['#198754', '#dc3545'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom' } }
            }
        });
    } catch (e) { console.error("Erro estatísticas:", e); }
}

async function carregarConvidadosAdmin() {
    try {
        convidadosCache = await req(API_CONVIDADOS);
        if (!byId('tabela-convidados-admin')) return;

        byId('tabela-convidados-admin').innerHTML = convidadosCache.map(c => `
            <tr>
                <td><strong>${c.nome} ${c.sobrenome}</strong> <span class="badge bg-light text-dark border ms-1"><i class="bi bi-people-fill"></i> ${calcTotal(c)}</span>
                ${c.acompanhantes?.length ? `<br><small class="text-muted"><i class="bi bi-arrow-return-right"></i> ${c.acompanhantes.map(a => `${a.nome} ${a.sobrenome}`).join(', ')}</small>` : ''}</td>
                <td>${c.cpf || 'N/A'}</td><td>${c.telefone || 'N/A'}</td>
                <td><span class="badge ${c.numero_mesa ? 'bg-secondary' : 'bg-danger'}">${c.numero_mesa ? `Mesa ${c.numero_mesa}` : 'S/ Mesa'}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirEdicao(${c.id_convidado})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusao(${c.id_convidado}, '${c.nome} ${c.sobrenome}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (e) { console.error("Erro convidados:", e); }
}

window.adicionarCampoAcompanhante = (d = null) => {
    byId('acompanhantes-container').insertAdjacentHTML('beforeend', `
        <div class="row mb-2 acompanhante-item align-items-center">
            <div class="col-5"><input type="text" class="form-control form-control-sm acomp-nome" placeholder="Nome" required value="${d?.nome || ''}"></div>
            <div class="col-5"><input type="text" class="form-control form-control-sm acomp-sobrenome" placeholder="Apelido" required value="${d?.sobrenome || ''}"></div>
            <div class="col-2 text-end"><button type="button" class="btn btn-sm btn-outline-danger" onclick="this.closest('.acompanhante-item').remove()"><i class="bi bi-trash"></i></button></div>
        </div>`);
};

window.abrirEdicao = (id) => {
    const c = convidadosCache.find(x => x.id_convidado === id);
    if (!c) return;
    ['id', 'nome', 'sobrenome', 'cpf', 'telefone', 'email', 'mesa'].forEach(k => byId(`cad-${k}`).value = c[k === 'mesa' ? 'numero_mesa' : (k === 'id' ? 'id_convidado' : k)] || '');
    byId('acompanhantes-container').innerHTML = ''; c.acompanhantes?.forEach(adicionarCampoAcompanhante);
    byId('modalNovoConvidadoLabel').innerText = "Editar Convidado"; new bootstrap.Modal(byId('modalNovoConvidado')).show();
};

window.abrirExclusao = (id, nome) => {
    byId('id-excluir').value = id; byId('nome-excluir').innerText = nome; new bootstrap.Modal(byId('modalExcluirConvidado')).show();
};

window.excluirConvidado = async () => {
    try {
        await req(`${API_CONVIDADOS}/${byId('id-excluir').value}`, 'DELETE');
        carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin(); fecharModal('modalExcluirConvidado');
    } catch (e) { alert("Erro ao excluir: " + (e.erro || '')); }
};

async function cadastrarConvidado(e) {
    e.preventDefault();
    const id = byId('cad-id').value, msg = byId('cadastro-msg');
    msg.className = 'd-none';

    const dados = {
        nome: byId('cad-nome').value, sobrenome: byId('cad-sobrenome').value, cpf: byId('cad-cpf').value,
        telefone: byId('cad-telefone').value, email: byId('cad-email').value, numero_mesa: byId('cad-mesa').value,
        acompanhantes: Array.from(document.querySelectorAll('.acompanhante-item')).map(el => ({ nome: el.querySelector('.acomp-nome').value, sobrenome: el.querySelector('.acomp-sobrenome').value }))
    };

    try {
        await req(`${API_CONVIDADOS}${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', dados);
        carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin(); fecharModal('modalNovoConvidado');
    } catch (e) { msg.innerText = e.erro || 'Erro.'; msg.className = 'text-danger text-center mt-2 d-block'; }
}

async function carregarMesasAdmin() {
    try {
        mesasCache = await req(API_MESAS);
        if (!byId('tabela-mesas-admin')) return;
        byId('tabela-mesas-admin').innerHTML = mesasCache.map(m => `
            <tr>
                <td><strong>Mesa ${m.numero_mesa}</strong></td><td>${m.capacidade}</td>
                <td><span class="badge ${m.ocupacao >= m.capacidade ? 'bg-danger' : (m.ocupacao > 0 ? 'bg-success' : 'bg-secondary')}">${m.ocupacao} / ${m.capacidade}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="abrirEdicaoMesa(${m.id_mesa})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusaoMesa(${m.id_mesa}, 'Mesa ${m.numero_mesa}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (e) { console.error("Erro mesas:", e); }
}

window.abrirEdicaoMesa = (id) => {
    const m = mesasCache.find(x => x.id_mesa === id);
    if (!m) return;
    byId('mesa-id').value = m.id_mesa; byId('mesa-numero').value = m.numero_mesa; byId('mesa-capacidade').value = m.capacidade;
    byId('modalMesaLabel').innerText = "Editar Mesa"; new bootstrap.Modal(byId('modalMesa')).show();
};

async function salvarMesa(e) {
    e.preventDefault();
    const id = byId('mesa-id').value, msg = byId('mesa-msg');
    try {
        await req(`${API_MESAS}${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', { numero_mesa: byId('mesa-numero').value, capacidade: byId('mesa-capacidade').value });
        carregarMesasAdmin(); carregarConvidadosAdmin(); fecharModal('modalMesa'); msg.className = 'd-none';
    } catch (e) { msg.innerText = e.erro || 'Erro.'; msg.className = 'text-danger small mt-2 d-block'; }
}

window.abrirExclusaoMesa = (id, nome) => {
    byId('id-excluir-mesa').value = id; byId('numero-excluir-mesa').innerText = nome; new bootstrap.Modal(byId('modalExcluirMesa')).show();
};

window.excluirMesa = async () => {
    try {
        await req(`${API_MESAS}/${byId('id-excluir-mesa').value}`, 'DELETE');
        carregarMesasAdmin(); carregarConvidadosAdmin(); fecharModal('modalExcluirMesa');
    } catch (e) { alert("Erro ao excluir."); }
};

async function carregarUsuariosAdmin() {
    try {
        usuariosCache = await req(API_USUARIOS);
        if (!byId('tabela-usuarios-admin')) return;
        byId('tabela-usuarios-admin').innerHTML = usuariosCache.map(u => `
            <tr>
                <td><strong>${u.nome}</strong></td><td>${u.cpf}</td>
                <td><span class="badge ${u.perfil === 'Admin' ? 'bg-primary' : 'bg-info text-dark'}">${u.perfil}</span></td>
                <td class="text-center">
                    <button class="btn btn-sm btn-outline-warning me-1" onclick="alternarPerfilUsuario(${u.id_usuario}, '${u.perfil}')"><i class="bi bi-arrow-left-right"></i></button>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="abrirEdicaoUsuario(${u.id_usuario})"><i class="bi bi-pencil-square"></i></button>
                    <button class="btn btn-sm btn-outline-danger" onclick="abrirExclusaoUsuario(${u.id_usuario}, '${u.nome}')"><i class="bi bi-trash"></i></button>
                </td>
            </tr>`).join('');
    } catch (e) { console.error("Erro usuários:", e); }
}

window.alternarPerfilUsuario = async (id, perfil) => {
    const novoPerfil = perfil === 'Admin' ? 'Cerimonialista' : 'Admin';
    if (!confirm(`Alterar para ${novoPerfil}?`)) return;
    try {
        await req(`${API_USUARIOS}/${id}/perfil`, 'PATCH', { perfil: novoPerfil }); carregarUsuariosAdmin();
    } catch (e) { alert(e.erro || "Erro."); }
};

window.abrirEdicaoUsuario = (id) => {
    const u = usuariosCache.find(x => x.id_usuario === id);
    if (!u) return;
    ['id', 'nome', 'cpf', 'email', 'perfil'].forEach(k => byId(`usu-${k}`).value = u[k === 'id' ? 'id_usuario' : k]);
    byId('usu-senha').value = ''; byId('usu-senha').required = false; byId('usu-senha').placeholder = "Vazio p/ manter";
    byId('modalUsuarioLabel').innerText = "Editar Usuário"; new bootstrap.Modal(byId('modalUsuario')).show();
};

async function salvarUsuario(e) {
    e.preventDefault();
    const id = byId('usu-id').value, senha = byId('usu-senha').value;
    const dados = { nome: byId('usu-nome').value, cpf: byId('usu-cpf').value, email: byId('usu-email').value, perfil: byId('usu-perfil').value };
    if (senha) dados.senha = senha;
    try {
        await req(`${API_USUARIOS}${id ? `/${id}` : ''}`, id ? 'PUT' : 'POST', dados);
        carregarUsuariosAdmin(); fecharModal('modalUsuario');
    } catch (e) { alert(e.erro || 'Erro ao guardar.'); }
}

window.abrirExclusaoUsuario = (id, nome) => {
    byId('id-excluir-usu').value = id; byId('nome-excluir-usu').innerText = nome; new bootstrap.Modal(byId('modalExcluirUsuario')).show();
};

window.excluirUsuario = async () => {
    try {
        await req(`${API_USUARIOS}/${byId('id-excluir-usu').value}`, 'DELETE');
        carregarUsuariosAdmin(); fecharModal('modalExcluirUsuario');
    } catch (e) { alert("Erro ao excluir."); }
};

const prepararExportacao = () => convidadosCache.map(c => ({
    Nome: c.nome, Sobrenome: c.sobrenome, CPF: c.cpf || '', Telefone: c.telefone || '', Email: c.email || '',
    Mesa: c.numero_mesa || '', Acompanhantes: c.acompanhantes?.map(a => `${a.nome} ${a.sobrenome}`).join(', ') || '', Status: c.ja_entrou ? 'Presente' : 'Ausente'
}));

window.exportarExcel = () => {
    if (!convidadosCache.length) return alert("Sem dados.");
    const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(prepararExportacao()), "Convidados");
    XLSX.writeFile(wb, `WeddingPass_Convidados_${Date.now()}.xlsx`);
};

window.exportarCSV = () => {
    if (!convidadosCache.length) return alert("Sem dados.");
    const blob = new Blob(["\uFEFF" + XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(prepararExportacao()))], { type: 'text/csv;charset=utf-8;' });
    Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: `WeddingPass_Convidados_${Date.now()}.csv` }).click();
};

window.gerarPDF = () => {
    if (!convidadosCache.length) return alert("Sem dados.");
    const doc = new window.jspdf.jsPDF();
    doc.text("Relatório de Convidados", 14, 20);
    doc.autoTable({
        head: [["Convidado e Grupo", "Mesa", "Status"]],
        body: convidadosCache.map(c => [`${c.nome} ${c.sobrenome}${c.acompanhantes?.length ? '\n' + c.acompanhantes.map(a => `- ${a.nome} ${a.sobrenome}`).join('\n') : ''}`, `Mesa ${c.numero_mesa}`, c.ja_entrou ? "Presente" : "Ausente"]),
        startY: 30
    });
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
    const fileInput = byId('file-import'), msg = byId('import-msg'), btn = byId('btn-processar-import');
    if (!fileInput.files.length) return alert('Selecione um arquivo.');

    const reader = new FileReader();
    reader.onload = async (e) => {
        const jsonData = XLSX.utils.sheet_to_json(XLSX.read(new Uint8Array(e.target.result),
            { type: 'array' }).Sheets[XLSX.read(new Uint8Array(e.target.result),
                { type: 'array' }).SheetNames[0]]);
        if (!jsonData.length) return alert('Arquivo vazio ou inválido.');

        btn.disabled = true; msg.className = 'text-primary fw-bold mt-2 d-block'; msg.innerHTML = `Processando ${jsonData.length} convidados...`;
        let sucessos = 0, erros = 0;

        for (const r of jsonData) {
            if (!r.Nome || !r.Sobrenome) { erros++; continue; }
            const acompanhantes = (r.Acompanhantes ? String(r.Acompanhantes).split(',') : []).map(n => {
                const p = n.trim().split(' '); return p[0] ? { nome: p[0], sobrenome: p.slice(1).join(' ') } : null;
            }).filter(Boolean);

            try {
                await req(API_CONVIDADOS, 'POST', {
                    nome: String(r.Nome).trim(),
                    sobrenome: String(r.Sobrenome).trim(),
                    cpf: r.CPF ? String(r.CPF).trim() : null,
                    telefone: r.Telefone ? String(r.Telefone).trim() : null,
                    email: r.Email ? String(r.Email).trim() : null,
                    numero_mesa: Number(r.Mesa) || 1,
                    acompanhantes
                });
                sucessos++;
            } catch { erros++; }
        }

        btn.disabled = false; msg.className = 'text-success fw-bold mt-2 d-block'; msg.innerText = `Concluído! Sucessos: ${sucessos} | Falhas: ${erros}`;
        fileInput.value = ''; carregarConvidadosAdmin(); carregarGraficoEstatisticas(); carregarMesasAdmin();
        setTimeout(() => { fecharModal('modalImportar'); msg.className = 'd-none'; }, 3000);
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
};