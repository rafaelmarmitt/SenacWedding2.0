require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/authRoutes');
const convidadosRoutes = require('./routes/convidadosRoutes');
const checkinRoutes = require('./routes/checkinRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');
const mesasRoutes = require('./routes/mesasRoutes');


const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globais
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '../frontend')));

// 1. ROTAS DA API (Backend)
app.use('/api/auth', authRoutes);
app.use('/api/convidados', convidadosRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/usuarios', usuariosRoutes);
app.use('/api/mesas', mesasRoutes);
// Rota de teste simples para garantir que a API está a funcionar
app.get('/api/status', (req, res) => {
    res.json({ status: 'API Wedding Pass Online!', porta: PORT });
});

// 2. SERVIR O FRONTEND (Arquivos Estáticos)
app.use(express.static(path.join(__dirname, '../frontend')));

// Rota de fallback
app.use((req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// INICIAR O SERVIDOR
app.listen(PORT, () => {
    console.log(` Servidor rodando na porta ${PORT}`);
    console.log(`http://localhost:${PORT}`);
});