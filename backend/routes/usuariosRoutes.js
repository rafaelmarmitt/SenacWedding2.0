const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuariosController');

router.get('/', usuariosController.listar);                 // GET /api/usuarios
router.post('/', usuariosController.criar);                 // POST /api/usuarios
router.put('/:id', usuariosController.editar);              // PUT /api/usuarios/:id
router.patch('/:id/perfil', usuariosController.alternarPerfil); // PATCH /api/usuarios/:id/perfil
router.delete('/:id', usuariosController.excluir);          // DELETE /api/usuarios/:id

module.exports = router;