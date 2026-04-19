const db = require('../config/db');
const cpfLib = require('js-cpf-validation');

// Listar convidados
exports.listar = async (req, res) => {
    try {
        const termo = req.query.busca ? `%${req.query.busca}%` : null;

        // Fazemos um JOIN com a tabela de mesas para devolver o numero_mesa ao Front-end
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
        const convidadosCompletos = [];

        for (let c of convidados) {
            const [acompanhantes] = await db.execute('SELECT nome, sobrenome FROM acompanhantes WHERE fk_convidado = ?', [c.id_convidado]);
            convidadosCompletos.push({ ...c, acompanhantes });
        }

        return res.json(convidadosCompletos);
    } catch (error) {
        console.error('Erro ao listar convidados:', error);
        return res.status(500).json({ erro: 'Erro ao obter dados.' });
    }
};

// Criar novo convidado
exports.criar = async (req, res) => {
    const { nome, sobrenome, cpf, telefone, email, numero_mesa, acompanhantes } = req.body;

    if (cpf && !cpfLib.isCPF(cpf)) return res.status(400).json({ erro: 'O CPF introduzido é inválido. Verifique os números.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        let fk_mesa = null;
        let capacidadeMesa = 8; // Capacidade por defeito caso a mesa tenha de ser criada automaticamente

        // LÓGICA DA NOVA TABELA DE MESAS: Descobrir o ID da mesa, criar se não existir, e VERIFICAR CAPACIDADE
        if (numero_mesa) {
            const [mesasExistentes] = await conn.execute('SELECT id_mesa, capacidade FROM mesas WHERE numero_mesa = ?', [numero_mesa]);

            if (mesasExistentes.length > 0) {
                fk_mesa = mesasExistentes[0].id_mesa;
                capacidadeMesa = mesasExistentes[0].capacidade;
            } else {
                // Se a mesa não existir, cria-a automaticamente com capacidade padrão
                const [novaMesa] = await conn.execute('INSERT INTO mesas (numero_mesa, capacidade) VALUES (?, ?)', [numero_mesa, capacidadeMesa]);
                fk_mesa = novaMesa.insertId;
            }

            // --- NOVA LÓGICA: VERIFICAÇÃO DE CAPACIDADE ---
            const queryOcupacao = `
                SELECT 
                    (SELECT COUNT(*) FROM convidados WHERE fk_mesa = ?) +
                    (SELECT COUNT(*) FROM acompanhantes a JOIN convidados c ON a.fk_convidado = c.id_convidado WHERE c.fk_mesa = ?)
                AS total_pessoas
            `;
            const [resOcupacao] = await conn.execute(queryOcupacao, [fk_mesa, fk_mesa]);
            const pessoasAtuais = parseInt(resOcupacao[0].total_pessoas) || 0;
            const pessoasEntrando = 1 + (acompanhantes ? acompanhantes.length : 0);

            if (pessoasAtuais + pessoasEntrando > capacidadeMesa) {
                await conn.rollback();
                return res.status(400).json({ erro: `A mesa ${numero_mesa} não tem lugares suficientes! (Capacidade: ${capacidadeMesa} | Ocupados: ${pessoasAtuais} | A entrar: ${pessoasEntrando})` });
            }
        }

        const [{ insertId }] = await conn.execute(
            'INSERT INTO convidados (nome, sobrenome, cpf, telefone, email, fk_mesa) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, sobrenome, cpf || null, telefone || null, email || null, fk_mesa]
        );

        if (acompanhantes?.length) {
            for (let a of acompanhantes) {
                await conn.execute('INSERT INTO acompanhantes (nome, sobrenome, fk_convidado) VALUES (?, ?, ?)', [a.nome, a.sobrenome, insertId]);
            }
        }

        await conn.commit();
        return res.status(201).json({ mensagem: 'Convidado registado!', id: insertId });
    } catch (error) {
        await conn.rollback();
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('cpf')) return res.status(409).json({ erro: 'Este CPF já está cadastrado para outro convidado.' });
        return res.status(500).json({ erro: 'Erro ao registar convidado.' });
    } finally {
        conn.release();
    }
};

// Editar convidado
exports.editar = async (req, res) => {
    const { id } = req.params;
    const { nome, sobrenome, cpf, telefone, email, numero_mesa, acompanhantes } = req.body;

    if (cpf && !cpfLib.isCPF(cpf)) return res.status(400).json({ erro: 'O CPF introduzido é inválido. Verifique os números.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();

        let fk_mesa = null;
        let capacidadeMesa = 8;

        // LÓGICA DA NOVA TABELA DE MESAS: Descobrir o ID, criar se não existir, e VERIFICAR CAPACIDADE
        if (numero_mesa) {
            const [mesasExistentes] = await conn.execute('SELECT id_mesa, capacidade FROM mesas WHERE numero_mesa = ?', [numero_mesa]);

            if (mesasExistentes.length > 0) {
                fk_mesa = mesasExistentes[0].id_mesa;
                capacidadeMesa = mesasExistentes[0].capacidade;
            } else {
                const [novaMesa] = await conn.execute('INSERT INTO mesas (numero_mesa, capacidade) VALUES (?, ?)', [numero_mesa, capacidadeMesa]);
                fk_mesa = novaMesa.insertId;
            }

            // --- NOVA LÓGICA: VERIFICAÇÃO DE CAPACIDADE (Excluindo o próprio convidado da contagem atual) ---
            const queryOcupacao = `
                SELECT 
                    (SELECT COUNT(*) FROM convidados WHERE fk_mesa = ? AND id_convidado != ?) +
                    (SELECT COUNT(*) FROM acompanhantes a JOIN convidados c ON a.fk_convidado = c.id_convidado WHERE c.fk_mesa = ? AND c.id_convidado != ?)
                AS total_pessoas
            `;
            const [resOcupacao] = await conn.execute(queryOcupacao, [fk_mesa, id, fk_mesa, id]);
            const pessoasAtuais = parseInt(resOcupacao[0].total_pessoas) || 0;
            const pessoasEntrando = 1 + (acompanhantes ? acompanhantes.length : 0);

            if (pessoasAtuais + pessoasEntrando > capacidadeMesa) {
                await conn.rollback();
                return res.status(400).json({ erro: `A mesa ${numero_mesa} não tem lugares suficientes! (Capacidade: ${capacidadeMesa} | Outros já na mesa: ${pessoasAtuais} | A entrar: ${pessoasEntrando})` });
            }
        }

        await conn.execute(
            'UPDATE convidados SET nome=?, sobrenome=?, cpf=?, telefone=?, email=?, fk_mesa=? WHERE id_convidado=?',
            [nome, sobrenome, cpf || null, telefone || null, email || null, fk_mesa, id]
        );

        await conn.execute('DELETE FROM acompanhantes WHERE fk_convidado = ?', [id]);

        if (acompanhantes?.length) {
            for (let a of acompanhantes) {
                await conn.execute('INSERT INTO acompanhantes (nome, sobrenome, fk_convidado) VALUES (?, ?, ?)', [a.nome, a.sobrenome, id]);
            }
        }

        await conn.commit();
        return res.json({ mensagem: 'Convidado atualizado com sucesso!' });
    } catch (error) {
        await conn.rollback();
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('cpf')) return res.status(409).json({ erro: 'Este CPF já está a ser utilizado por outro convidado.' });
        return res.status(500).json({ erro: 'Erro ao atualizar convidado.' });
    } finally {
        conn.release();
    }
};

// Excluir convidado
exports.excluir = async (req, res) => {
    const { id } = req.params;
    const conn = await db.getConnection();

    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM convidados WHERE id_convidado = ?', [id]);
        await conn.commit();
        return res.json({ mensagem: 'Convidado removido com sucesso!' });
    } catch (error) {
        await conn.rollback();
        console.error('Erro ao excluir:', error);
        return res.status(500).json({ erro: 'Erro ao excluir convidado.' });
    } finally {
        conn.release();
    }
};