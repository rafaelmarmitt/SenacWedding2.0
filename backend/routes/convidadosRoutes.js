const express = require('express');
const router = express.Router();
const convidadosController = require('../controllers/convidadosController');

router.get('/', convidadosController.listar);         // GET /api/convidados
router.post('/', convidadosController.criar);         // POST /api/convidados
router.put('/:id', convidadosController.editar);      // PUT /api/convidados/:id
router.delete('/:id', convidadosController.excluir);  // DELETE /api/convidados/:id

module.exports = router;