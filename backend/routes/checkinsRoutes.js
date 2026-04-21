const express = require('express');
const router = express.Router();
const checkinsController = require('../controllers/checkinsController');

router.post('/', checkinsController.realizarCheckin);         // POST /api/checkins
router.get('/estatisticas', checkinsController.obterEstatisticas); // GET /api/checkins/estatisticas

module.exports = router;