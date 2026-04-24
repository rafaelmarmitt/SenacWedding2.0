const db = require('../config/db');

// Listar mesas
exports.listar = async (req, res) => {
    try {
        const query = `
            SELECT 
                m.id_mesa, 
                m.numero_mesa, 
                m.capacidade,
                COUNT(DISTINCT c.id_convidado) + COUNT(a.id_acompanhante) AS ocupacao
            FROM mesas m
            LEFT JOIN convidados c ON m.id_mesa = c.fk_mesa
            LEFT JOIN acompanhantes a ON c.id_convidado = a.fk_convidado
            GROUP BY m.id_mesa, m.numero_mesa, m.capacidade
            ORDER BY m.numero_mesa ASC
        `;
        const [mesas] = await db.execute(query);
        return res.json(mesas);
    } catch (error) {
        console.error('Erro ao listar mesas:', error);
        return res.status(500).json({ erro: 'Erro ao obter a lista de mesas.' });
    }
};

// Criar mesa
exports.criar = async (req, res) => {
    const { numero_mesa, capacidade } = req.body;

    if (!numero_mesa) {
        return res.status(400).json({ erro: 'O número da mesa é obrigatório.' });
    }

    try {
        const cap = capacidade || 8; // Capacidade padrão se não for enviada
        const [{ insertId }] = await db.execute(
            'INSERT INTO mesas (numero_mesa, capacidade) VALUES (?, ?)',
            [numero_mesa, cap]
        );
        return res.status(201).json({ mensagem: 'Mesa criada com sucesso!', id: insertId });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Já existe uma mesa com este número.' });
        }
        console.error('Erro ao criar mesa:', error);
        return res.status(500).json({ erro: 'Erro interno ao criar mesa.' });
    }
};

// Editar mesa
exports.editar = async (req, res) => {
    const { id } = req.params;
    const { numero_mesa, capacidade } = req.body;

    if (!numero_mesa || !capacidade) return res.status(400).json({ erro: 'Número e capacidade são obrigatórios.' });

    try {
        const [[{ ocupacao }]] = await db.execute(`
            SELECT COUNT(DISTINCT c.id_convidado) + COUNT(a.id_acompanhante) AS ocupacao
            FROM convidados c LEFT JOIN acompanhantes a ON c.id_convidado = a.fk_convidado
            WHERE c.fk_mesa = ?
        `, [id]);

        if (capacidade < ocupacao) return res.status(400).json({ erro: `Capacidade inválida: a mesa já possui ${ocupacao} pessoas.` });
        await db.execute('UPDATE mesas SET numero_mesa=?, capacidade=? WHERE id_mesa=?', [numero_mesa, capacidade, id]);
        return res.json({ mensagem: 'Mesa atualizada com sucesso!' });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ erro: 'Já existe outra mesa com este número.' });
        console.error('Erro ao editar mesa:', error);
        return res.status(500).json({ erro: 'Erro interno ao atualizar a mesa.' });
    }
};

// Excluir uma mesa
exports.excluir = async (req, res) => {
    const { id } = req.params;

    try {
        await db.execute('DELETE FROM mesas WHERE id_mesa=?', [id]);
        return res.json({ mensagem: 'Mesa removida! Os convidados desta mesa ficaram sem lugar atribuído.' });
    } catch (error) {
        console.error('Erro ao excluir mesa:', error);
        return res.status(500).json({ erro: 'Erro ao remover a mesa.' });
    }
};