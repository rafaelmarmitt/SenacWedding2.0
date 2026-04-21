const express = require('express');
const router = express.Router();
const checkinController = require('../controllers/checkinsController');

router.post('/', checkinController.realizarCheckin);         // POST /api/checkins
router.get('/estatisticas', checkinController.obterEstatisticas); // GET /api/checkins/estatisticas

module.exports = router;