const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/db');

// Função de Login
exports.login = async (req, res) => {
    const { email, senha } = req.body;

    if (!email || !senha) {
        return res.status(400).json({ erro: 'E-mail e palavra-passe são obrigatórios.' });
    }

    try {
        // Procura o utilizador na base de dados
        const [[usuario]] = await db.execute('SELECT * FROM usuarios WHERE email = ?', [email]);

        // Se não existir ou a palavra-passe não coincidir, retorna erro
        if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
            return res.status(401).json({ erro: 'Credenciais inválidas.' });
        }

        // Gera o Token JWT válido por 8 horas
        const token = jwt.sign(
            { id_usuario: usuario.id_usuario, perfil: usuario.perfil, nome: usuario.nome },
            process.env.JWT_SECRET || 'ChaveSecreta',
            { expiresIn: '8h' }
        );

        return res.json({
            mensagem: 'Login efetuado com sucesso!',
            token,
            usuario: { id: usuario.id_usuario, nome: usuario.nome, perfil: usuario.perfil }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        return res.status(500).json({ erro: 'Erro interno no servidor.' });
    }
};