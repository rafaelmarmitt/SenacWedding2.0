const db = require('../config/db');
const cpfLib = require('js-cpf-validation');

// --- Função Auxiliar Privada para Otimizar a Lógica das Mesas ---
async function validarMesa(conn, numMesa, acompanhantes, idIgnorar = null) {
    if (!numMesa) return null;
    const qtdEntrando = 1 + (acompanhantes?.length || 0);

    const [mesas] = await conn.execute('SELECT id_mesa, capacidade FROM mesas WHERE numero_mesa = ?', [numMesa]);

    // Se a mesa não existe, cria-a com capacidade padrão de 8
    if (!mesas.length) {
        if (qtdEntrando > 8) throw { status: 400, erro: `A mesa ${numMesa} excede a capacidade padrão (8)!` };
        const [novaMesa] = await conn.execute('INSERT INTO mesas (numero_mesa, capacidade) VALUES (?, 8)', [numMesa]);
        return novaMesa.insertId;
    }

    const { id_mesa, capacidade } = mesas[0];
    const cond = idIgnorar ? 'AND id_convidado != ?' : '';
    const params = idIgnorar ? [id_mesa, idIgnorar, id_mesa, idIgnorar] : [id_mesa, id_mesa];

    // Calcula ocupação atual da mesa
    const [[{ total }]] = await conn.execute(`SELECT 
        (SELECT COUNT(*) FROM convidados WHERE fk_mesa = ? ${cond}) +
        (SELECT COUNT(*) FROM acompanhantes a JOIN convidados c ON a.fk_convidado = c.id_convidado WHERE c.fk_mesa = ? ${cond}) AS total
    `, params);

    if (Number(total) + qtdEntrando > capacidade) {
        throw { status: 400, erro: `A mesa ${numMesa} não tem lugares suficientes! (Capacidade: ${capacidade} | Ocupados: ${total} | A entrar: ${qtdEntrando})` };
    }

    return id_mesa;
}

// ==========================================
// CONTROLADORES
// ==========================================

exports.listar = async (req, res) => {
    try {
        const termo = req.query.busca ? `%${req.query.busca}%` : null;

        let query = `SELECT c.*, m.numero_mesa, EXISTS(SELECT 1 FROM checkins ch WHERE ch.id_convidado = c.id_convidado) AS ja_entrou 
                     FROM convidados c LEFT JOIN mesas m ON c.fk_mesa = m.id_mesa`;
        if (termo) query += ` WHERE c.nome LIKE ? OR c.sobrenome LIKE ? OR c.cpf LIKE ?`;
        query += ` ORDER BY c.nome ASC`;

        const [convidados] = await db.execute(query, termo ? [termo, termo, termo] : []);

        // Promise.all executa as queries dos acompanhantes em paralelo (Muito mais rápido que o for...of)
        const convidadosCompletos = await Promise.all(convidados.map(async c => {
            const [acompanhantes] = await db.execute('SELECT nome, sobrenome FROM acompanhantes WHERE fk_convidado = ?', [c.id_convidado]);
            return { ...c, acompanhantes };
        }));

        return res.json(convidadosCompletos);
    } catch (error) {
        console.error('Erro ao listar:', error);
        return res.status(500).json({ erro: 'Erro ao obter dados.' });
    }
};

exports.criar = async (req, res) => {
    const { nome, sobrenome, cpf, telefone, email, numero_mesa, acompanhantes } = req.body;
    if (cpf && !cpfLib.isValidCPF(cpf)) return res.status(400).json({ erro: 'O CPF introduzido é inválido.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const fk_mesa = await validarMesa(conn, numero_mesa, acompanhantes);

        const [{ insertId }] = await conn.execute(
            'INSERT INTO convidados (nome, sobrenome, cpf, telefone, email, fk_mesa) VALUES (?, ?, ?, ?, ?, ?)',
            [nome, sobrenome, cpf || null, telefone || null, email || null, fk_mesa]
        );

        if (acompanhantes?.length) {
            await Promise.all(acompanhantes.map(a =>
                conn.execute('INSERT INTO acompanhantes (nome, sobrenome, fk_convidado) VALUES (?, ?, ?)', [a.nome, a.sobrenome, insertId])
            ));
        }

        await conn.commit();
        return res.status(201).json({ mensagem: 'Convidado registado!', id: insertId });
    } catch (error) {
        await conn.rollback();
        if (error.status) return res.status(error.status).json({ erro: error.erro });
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('cpf')) return res.status(409).json({ erro: 'Este CPF já está cadastrado.' });
        return res.status(500).json({ erro: 'Erro ao registar convidado.' });
    } finally {
        conn.release();
    }
};

exports.editar = async (req, res) => {
    const { id } = req.params;
    const { nome, sobrenome, cpf, telefone, email, numero_mesa, acompanhantes } = req.body;
    if (cpf && !cpfLib.isValidCPF(cpf)) return res.status(400).json({ erro: 'O CPF introduzido é inválido.' });

    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        const fk_mesa = await validarMesa(conn, numero_mesa, acompanhantes, id);

        await conn.execute(
            'UPDATE convidados SET nome=?, sobrenome=?, cpf=?, telefone=?, email=?, fk_mesa=? WHERE id_convidado=?',
            [nome, sobrenome, cpf || null, telefone || null, email || null, fk_mesa, id]
        );

        // Atualizar acompanhantes: Limpar antigos e inserir os novos em paralelo
        await conn.execute('DELETE FROM acompanhantes WHERE fk_convidado = ?', [id]);
        if (acompanhantes?.length) {
            await Promise.all(acompanhantes.map(a =>
                conn.execute('INSERT INTO acompanhantes (nome, sobrenome, fk_convidado) VALUES (?, ?, ?)', [a.nome, a.sobrenome, id])
            ));
        }

        await conn.commit();
        return res.json({ mensagem: 'Convidado atualizado com sucesso!' });
    } catch (error) {
        await conn.rollback();
        if (error.status) return res.status(error.status).json({ erro: error.erro });
        if (error.code === 'ER_DUP_ENTRY' && error.message.includes('cpf')) return res.status(409).json({ erro: 'Este CPF já está a ser utilizado.' });
        return res.status(500).json({ erro: 'Erro ao atualizar convidado.' });
    } finally {
        conn.release();
    }
};

exports.excluir = async (req, res) => {
    const conn = await db.getConnection();
    try {
        await conn.beginTransaction();
        await conn.execute('DELETE FROM convidados WHERE id_convidado = ?', [req.params.id]);
        await conn.commit();
        return res.json({ mensagem: 'Convidado removido com sucesso!' });
    } catch (error) {
        await conn.rollback();
        return res.status(500).json({ erro: 'Erro ao excluir convidado.' });
    } finally {
        conn.release();
    }
};