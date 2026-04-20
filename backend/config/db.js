require('dotenv').config();
const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,  
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection()
    .then(conn => {
        console.log('[Base de Dados] Ligação à base de dados wedding_pass estabelecida com sucesso!');
        conn.release(); 
    })
    .catch(err => {
        console.error('[Base de Dados] Erro ao ligar ao MySQL:', err.message);
    });

module.exports = db;