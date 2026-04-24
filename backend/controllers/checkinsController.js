const db = require('../config/db');

// Realizar o check-in de um convidado
exports.realizarCheckin = async (req, res) => {
    const { id_usuario, id_convidado } = req.body;

    if (!id_usuario || !id_convidado) {
        return res.status(400).json({ erro: 'ID do utilizador e do convidado são obrigatórios.' });
    }

    try {
        const [result] = await db.execute(
            'INSERT INTO checkins (id_usuario, id_convidado) VALUES (?, ?)',
            [id_usuario, id_convidado]
        );
        
        return res.status(201).json({ mensagem: 'Check-in realizado com sucesso!', id_checkin: result.insertId });

    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'Este convidado já efetuou o check-in.' });
        }
        console.error('Erro ao fazer check-in:', error);
        return res.status(500).json({ erro: 'Erro interno no servidor de check-ins.' });
    }
};

// Obter dados estatísticos
exports.obterEstatisticas = async (req, res) => {
    try {
        const [[{ presentes }]] = await db.execute(
            'SELECT COUNT(c.id_convidado) AS presentes FROM convidados c JOIN checkins ch ON c.id_convidado = ch.id_convidado'
        );
        
        return res.json({ presentes });
    } catch (error) {
        console.error('Erro nas estatísticas:', error);
        return res.status(500).json({ erro: 'Erro ao carregar estatísticas.' });
    }
};