const mongoose = require('mongoose');

const AgendamentoSchema = new mongoose.Schema({
  nome: String,
  telefone: String,
  servico: String,
  data: String,
  horario: String,
  valor: Number,
  criadoEm: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Agendamento', AgendamentoSchema);