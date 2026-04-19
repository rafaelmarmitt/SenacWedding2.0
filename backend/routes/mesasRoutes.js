const express = require('express');
const router = express.Router();
const mesasController = require('../controllers/mesasController');

router.get('/', mesasController.listar);            // GET /api/mesas
router.post('/', mesasController.criar);            // POST /api/mesas
router.put('/:id', mesasController.editar);         // PUT /api/mesas/:id
router.delete('/:id', mesasController.excluir);     // DELETE /api/mesas/:id

module.exports = router;