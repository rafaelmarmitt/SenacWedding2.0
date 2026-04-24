const db = require('../config/db');
const cpfLib = require('js-cpf-validation');

// Listar convidados
exports.listar = async (req, res) => {
    try {
        const termo = req.query.busca ? `%${req.query.busca}%` : null;
        
        const query = termo 
            ? `SELECT c.*, m.numero_mesa, EXISTS(SELECT 1 FROM checkins ch WHERE ch.id_convidado = c.id_convidado) AS ja_entrou 
               FROM convidados c 
               LEFT JOIN mesas m ON c.fk_mesa = m.id_mesa 
               WHERE c.nome LIKE ? OR c.sobrenome LIKE ? OR c.cpf LIKE ? 
               ORDER BY c.nome ASC`
            : `SELECT c.*, m.numero_mesa, EXISTS(SELECT 1 FROM checkins ch WHERE ch.id_convidado = c.id_convidado) AS ja_entrou 
               FROM convidados c 
               LEFT JOIN mesas m ON c.fk_mesa = m.id_mesa 
               ORDER BY c.nome ASC`;
            
        const [convidados] = await db.execute(query, termo ? [termo, termo, termo] : []);

        // Preenche os acompanhantes de cada convidado
        for (let c of convidados) {
            const [acompanhantes] = await db.execute('SELECT nome, sobrenome FROM acompanhantes WHERE fk_convidado = ?', [c.id_convidado]);
            c.acompanhantes = acompanhantes;
        }

        return res.json(convidados);
    } catch (error) {
        console.error('Erro ao listar:', error);
        return res.status(500).json({ erro: 'Erro ao obter dados.' });
    }
};

// FUNÇÃO AUXILIAR (DRY)
// Valida a existência e a capacidade da mesa
const verificarMesa = async (numero_mesa, qtd_entrando, id_ignorar = null) => {
    const [mesas] = await db.execute('SELECT id_mesa, capacidade FROM mesas WHERE numero_mesa = ?', [numero_mesa]);
    if (mesas.length === 0) return { erro: `A mesa ${numero_mesa} não existe. Crie-a no painel primeiro.` };

    const fk_mesa = mesas[0].id_mesa;
    const query = `
        SELECT COUNT(DISTINCT c.id_convidado) + COUNT(a.id_acompanhante) AS total
        FROM convidados c
        LEFT JOIN acompanhantes a ON c.id_convidado = a.fk_convidado
        WHERE c.fk_mesa = ? ${id_ignorar ? 'AND c.id_convidado != ?' : ''}
    `;
    
    // Passa o ID a ignorar (para não contar as pessoas de um convidado que apenas está a ser editado)
    const [ocupacao] = await db.execute(query, id_ignorar ? [fk_mesa, id_ignorar] : [fk_mesa]);
    
    const pessoasAtuais = parseInt(ocupacao[0].total) || 0;
    if (pessoasAtuais + qtd_entrando > mesas[0].capacidade) return { erro: `A mesa ${numero_mesa} excedeu a capacidade.` };

    return { fk_mesa }; // Devolve o ID da mesa caso passe nas validações
};

// Criar novo convidado
exports.criar = async (req, res) => {
    const { nome, sobrenome, cpf, telefone, email, numero_mesa, acompanhantes } = req.body;
    
    if (cpf && !cpfLib.isCPF(cpf)) return res.status(400).json({ erro: 'CPF inválido.' });

    try {
        let fk_mesa = null;

        if (numero_mesa) {
            // Usa a função auxiliar para não repetir código!
            const validacao = await verificarMesa(numero_mesa, 1 + (acompanhantes ? acompanhantes.length : 0));
            if (validacao.erro) return res.status(400).json({ erro: validacao.erro });
            fk_mesa = validacao.fk_mesa;
        }

        const [{ insertId }] = await db.execute(
            'INSERT INTO convidados (nome, sobrenome, cpf, telefone, email, fk_mesa) VALUES (?, ?, ?, ?, ?, ?)', 
            [nome, sobrenome, cpf || null, telefone || null, email || null, fk_mesa]
        );
        
        if (acompanhantes?.length) {
            for (let a of acompanhantes) {
                await db.execute('INSERT INTO acompanhantes (nome, sobrenome, fk_convidado) VALUES (?, ?, ?)', [a.nome, a.sobrenome, insertId]);
            }
        }

        return res.status(201).json({ mensagem: 'Convidado registado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Este CPF já está cadastrado.' });
        console.error('Erro ao registar:', error);
        return res.status(500).json({ erro: 'Erro ao registar convidado.' });
    }
};

// Editar convidado
exports.editar = async (req, res) => {
    const { id } = req.params;
    const { nome, sobrenome, cpf, telefone, email, numero_mesa, acompanhantes } = req.body;
    
    if (cpf && !cpfLib.isCPF(cpf)) return res.status(400).json({ erro: 'CPF inválido.' });

    try {
        let fk_mesa = null;

        if (numero_mesa) {
            // Reaproveita a mesma função, passando o "id" para ser ignorado no cálculo
            const validacao = await verificarMesa(numero_mesa, 1 + (acompanhantes ? acompanhantes.length : 0), id);
            if (validacao.erro) return res.status(400).json({ erro: validacao.erro });
            fk_mesa = validacao.fk_mesa;
        }

        await db.execute(
            'UPDATE convidados SET nome=?, sobrenome=?, cpf=?, telefone=?, email=?, fk_mesa=? WHERE id_convidado=?', 
            [nome, sobrenome, cpf || null, telefone || null, email || null, fk_mesa, id]
        );
        
        await db.execute('DELETE FROM acompanhantes WHERE fk_convidado = ?', [id]);
        
        if (acompanhantes?.length) {
            for (let a of acompanhantes) {
                await db.execute('INSERT INTO acompanhantes (nome, sobrenome, fk_convidado) VALUES (?, ?, ?)', [a.nome, a.sobrenome, id]);
            }
        }

        return res.json({ mensagem: 'Convidado atualizado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Este CPF já está cadastrado.' });
        console.error('Erro ao atualizar:', error);
        return res.status(500).json({ erro: 'Erro ao atualizar convidado.' });
    }
};

// Excluir convidado
exports.excluir = async (req, res) => {
    try {
        await db.execute('DELETE FROM convidados WHERE id_convidado = ?', [req.params.id]);
        return res.json({ mensagem: 'Convidado removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir:', error);
        return res.status(500).json({ erro: 'Erro ao excluir convidado.' });
    }
};