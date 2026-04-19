const db = require('../config/db');

// Listar todas as mesas com a sua ocupação atual
exports.listar = async (req, res) => {
    try {
        const query = `
            SELECT 
                m.id_mesa, 
                m.numero_mesa, 
                m.capacidade,
                (
                    SELECT COUNT(*) FROM convidados c WHERE c.fk_mesa = m.id_mesa
                ) + (
                    SELECT COUNT(*) FROM acompanhantes a 
                    JOIN convidados c ON a.fk_convidado = c.id_convidado 
                    WHERE c.fk_mesa = m.id_mesa
                ) AS ocupacao
            FROM mesas m
            ORDER BY m.numero_mesa ASC
        `;
        const [mesas] = await db.execute(query);
        return res.json(mesas);
    } catch (error) {
        console.error('Erro ao listar mesas:', error);
        return res.status(500).json({ erro: 'Erro ao obter a lista de mesas.' });
    }
};

// Criar uma nova mesa manualmente
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

// Editar a capacidade ou número de uma mesa
exports.editar = async (req, res) => {
    const { id } = req.params;
    const { numero_mesa, capacidade } = req.body;

    if (!numero_mesa || !capacidade) {
        return res.status(400).json({ erro: 'O número da mesa e a capacidade são obrigatórios.' });
    }

    const conn = await db.getConnection();
    try {
        // Verificar se a nova capacidade é menor que a ocupação atual
        const queryOcupacao = `
            SELECT 
                (SELECT COUNT(*) FROM convidados c WHERE c.fk_mesa = ?) +
                (SELECT COUNT(*) FROM acompanhantes a JOIN convidados c ON a.fk_convidado = c.id_convidado WHERE c.fk_mesa = ?)
            AS ocupacao
        `;
        const [resOcupacao] = await conn.execute(queryOcupacao, [id, id]);
        const ocupacaoAtual = parseInt(resOcupacao[0].ocupacao) || 0;

        if (capacidade < ocupacaoAtual) {
            return res.status(400).json({ 
                erro: `Não pode reduzir a capacidade para ${capacidade}. A mesa já tem ${ocupacaoAtual} pessoas atribuídas.` 
            });
        }

        await conn.execute(
            'UPDATE mesas SET numero_mesa=?, capacidade=? WHERE id_mesa=?',
            [numero_mesa, capacidade, id]
        );

        return res.json({ mensagem: 'Mesa atualizada com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Já existe outra mesa com este número.' });
        }
        console.error('Erro ao editar mesa:', error);
        return res.status(500).json({ erro: 'Erro interno ao atualizar a mesa.' });
    } finally {
        conn.release();
    }
};

// Excluir uma mesa
exports.excluir = async (req, res) => {
    const { id } = req.params;

    try {
        // Como a Chave Estrangeira foi criada com "ON DELETE SET NULL", 
        // os convidados não serão apagados, apenas ficarão com a mesa "NULL" (sem mesa).
        await db.execute('DELETE FROM mesas WHERE id_mesa=?', [id]);
        return res.json({ mensagem: 'Mesa removida! Os convidados desta mesa ficaram sem lugar atribuído.' });
    } catch (error) {
        console.error('Erro ao excluir mesa:', error);
        return res.status(500).json({ erro: 'Erro ao remover a mesa.' });
    }
};