const db = require('../config/db');
const bcrypt = require('bcrypt');

// Listar utilizadores
exports.listar = async (req, res) => {
    try {
        const [usuarios] = await db.execute('SELECT id_usuario, nome, cpf, email, perfil FROM usuarios ORDER BY nome ASC');
        return res.json(usuarios);
    } catch (error) {
        console.error('Erro ao listar utilizadores:', error);
        return res.status(500).json({ erro: 'Erro ao obter a lista de utilizadores.' });
    }
};

// Criar utilizador
exports.criar = async (req, res) => {
    const { nome, cpf, email, senha, perfil } = req.body;

    if (!nome || !cpf || !email || !senha || !perfil) {
        return res.status(400).json({ erro: 'Todos os campos são obrigatórios para um novo registo.' });
    }

    try {
        const hash = await bcrypt.hash(senha, 10);

        await db.execute('INSERT INTO usuarios (nome, cpf, email, senha, perfil) VALUES (?, ?, ?, ?, ?)', [nome, cpf, email, hash, perfil]);
        return res.status(201).json({ mensagem: 'Utilizador criado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'O E-mail ou CPF inserido já está registado no sistema.' });
        }
        console.error('Erro ao criar utilizador:', error);
        return res.status(500).json({ erro: 'Erro interno ao criar utilizador.' });
    }
};

// Editar utilizador
exports.editar = async (req, res) => {
    const { id } = req.params;
    const { nome, cpf, email, senha, perfil } = req.body;

    try {
        if (senha) {
            const hash = await bcrypt.hash(senha, 10);
            await db.execute('UPDATE usuarios SET nome=?, cpf=?, email=?, senha=?, perfil=? WHERE id_usuario=?', [nome, cpf, email, hash, perfil, id]);
        } else {
            await db.execute('UPDATE usuarios SET nome=?, cpf=?, email=?, perfil=? WHERE id_usuario=?', [nome, cpf, email, perfil, id]);
        }

        return res.json({ mensagem: 'Utilizador atualizado com sucesso!' });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ erro: 'O E-mail ou CPF inserido já está a ser utilizado.' });
        }
        console.error('Erro ao editar utilizador:', error);
        return res.status(500).json({ erro: 'Erro interno ao atualizar utilizador.' });
    }
};

// Alternar rapidamente o perfil (Admin <-> Cerimonialista)
exports.alternarPerfil = async (req, res) => {
    const { id } = req.params;
    const { perfil } = req.body;

    try {
        await db.execute('UPDATE usuarios SET perfil=? WHERE id_usuario=?', [perfil, id]);
        return res.json({ mensagem: 'Perfil atualizado com sucesso!' });
    } catch (error) {
        console.error('Erro ao alternar perfil:', error);
        return res.status(500).json({ erro: 'Erro ao alterar o perfil de acesso.' });
    }
};

// Excluir um utilizador
exports.excluir = async (req, res) => {
    const { id } = req.params;

    try {
        await db.execute('DELETE FROM usuarios WHERE id_usuario=?', [id]);
        return res.json({ mensagem: 'Utilizador removido com sucesso!' });
    } catch (error) {
        console.error('Erro ao excluir utilizador:', error);
        return res.status(500).json({ erro: 'Erro ao remover o acesso do utilizador.' });
    }
};