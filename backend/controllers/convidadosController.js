const db = require('../config/db');
const cpfLib = require('js-cpf-validation');

// Listar convidados
exports.listar = async (req, res) => {
    try {
        const termo = req.query.busca ? `%${req.query.busca}%` : null;
        
        const query = termo 
            ? 'SELECT c.*, EXISTS(SELECT 1 FROM checkins ch WHERE ch.id_convidado = c.id_convidado) AS ja_entrou FROM convidados c WHERE c.nome LIKE ? OR c.sobrenome LIKE ? OR c.cpf LIKE ? ORDER BY c.nome ASC'
            : 'SELECT c.*, EXISTS(SELECT 1 FROM checkins ch WHERE ch.id_convidado = c.id_convidado) AS ja_entrou FROM convidados c ORDER BY c.nome ASC';
            
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
        const [{ insertId }] = await conn.execute(
            'INSERT INTO convidados (nome, sobrenome, cpf, telefone, email, numero_mesa) VALUES (?, ?, ?, ?, ?, ?)', 
            [nome, sobrenome, cpf || null, telefone || null, email || null, numero_mesa]
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
        
        await conn.execute(
            'UPDATE convidados SET nome=?, sobrenome=?, cpf=?, telefone=?, email=?, numero_mesa=? WHERE id_convidado=?', 
            [nome, sobrenome, cpf || null, telefone || null, email || null, numero_mesa, id]
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