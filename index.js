require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const schedule = require('node-schedule');
const { adicionarAgendamento, removerAgendamento } = require('./sheets');
const { enviarWhatsapp } = require('./whatsapp');
const conectarMongo = require('./db');
const Agendamento = require('./models/Agendamento');
const moment = require('moment');

const userStates = {};

const app = express();
const PORT = process.env.PORT || 3000;

const servicosDisponiveis = {
  "Corte": 30,
  "Barba": 20,
  "Corte + Barba": 45
};

// Cria bot SEM polling
const bot = new TelegramBot(process.env.TELEGRAM_TOKEN);

// Configura Webhook
bot.setWebHook(`${process.env.PUBLIC_URL}/bot${process.env.TELEGRAM_TOKEN}`);

// Middleware Express pra JSON
app.use(express.json());

// Endpoint que o Telegram chama
app.post(`/bot${process.env.TELEGRAM_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Inicializa o servidor Express
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});

(async () => {
  await conectarMongo();
})();

// 📌 Comandos fixos

bot.onText(/\/ajuda/, (msg) => {
  bot.sendMessage(msg.chat.id, `
ℹ️ *Comandos disponíveis:*
/ajuda - Ver comandos
/servicos - Ver serviços disponíveis
/horarios - Ver horários disponíveis
/agendar - Iniciar novo agendamento
/cancelar - Cancelar agendamento atual
`, { parse_mode: 'Markdown' });
});


bot.onText(/\/servicos/, (msg) => {
  bot.sendMessage(msg.chat.id, `
💈 *Serviços disponíveis:*
 💇 Corte — R$ ${servicosDisponiveis["Corte"].toFixed(2)}
 🧔 Barba — R$ ${servicosDisponiveis["Barba"].toFixed(2)}
 ✂️ Corte + Barba — R$ ${servicosDisponiveis["Corte + Barba"].toFixed(2)}
`, { parse_mode: 'Markdown' });
});

bot.onText(/\/horarios/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🕒 *Horário de atendimento:*
Segunda a Sábado
Das 09:00 às 16:00
`, { parse_mode: 'Markdown' });
});

bot.onText(/\/agendar/, (msg) => {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: 'ask_name' };
  bot.sendMessage(chatId, '👋 Vamos começar um novo agendamento!\nQual é o seu nome?');
});

bot.onText(/\/cancelar/, (msg) => {
  const chatId = msg.chat.id;
  userStates[chatId] = { step: 'cancel_nome' };
  bot.sendMessage(chatId, '❌ Vamos cancelar um agendamento. Por favor, informe seu nome:');
});


bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Ignorar comandos como /ajuda, /servicos, etc.
  if (text.startsWith('/')) return;


  if (!userStates[chatId]) {
    userStates[chatId] = { step: 'ask_name' };
  
    const mensagemBoasVindas = `
  👋 *Bem-vindo à Barbearia X!*
  
  ℹ️ *Comandos disponíveis:*
  /ajuda - Ver comandos
  /servicos - Ver serviços disponíveis
  /horarios - Ver horários de atendimento
  /agendar - Iniciar um novo agendamento
  /cancelar - Cancelar agendamento atual
  
  🕒 *Horário de atendimento:*
  Segunda a Sábado, das 09:00 às 16:00
  
  Para começar, digite seu nome abaixo:
  `;
  
    return bot.sendMessage(chatId, mensagemBoasVindas, { parse_mode: 'Markdown' });
  }
  

  const state = userStates[chatId];

  switch (state.step) {
    case 'ask_name':
      state.name = text;
      state.step = 'ask_phone';
      bot.sendMessage(chatId, '📞 Qual seu número de WhatsApp (com DDD)? Ex: 11987654321');
      break;

    case 'ask_phone':
      state.phone = text;
      state.step = 'ask_service';
      bot.sendMessage(chatId, `Qual serviço você deseja?\n💇 Corte — R$ ${servicosDisponiveis["Corte"].toFixed(2)}\n🧔 Barba — R$ ${servicosDisponiveis["Barba"].toFixed(2)}\n💈 Corte + Barba — R$ ${servicosDisponiveis["Corte + Barba"].toFixed(2)}`);
      break;

    case 'ask_service':
      if (!servicosDisponiveis[text]) {
        return bot.sendMessage(chatId, '❌ Serviço inválido. Por favor, escolha entre:\n💇 Corte\n🧔 Barba\n💈 Corte + Barba');
      }

      state.service = text;
      state.price = servicosDisponiveis[text]; // salva o valor

      state.step = 'ask_date';
      bot.sendMessage(chatId, '📅 Qual a data desejada? (formato DD/MM/AAAA)');
      break;

    case 'ask_date':
      if (!moment(text, 'DD/MM/YYYY', true).isValid()) {
        return bot.sendMessage(chatId, '❌ Data inválida. Use o formato DD/MM/AAAA.');
      }
      
      const dataInformada = moment(text, 'DD/MM/YYYY');

      if (dataInformada.isoWeekday() === 7) {
        return bot.sendMessage(chatId, '⛔ Não realizamos atendimentos aos domingos. Por favor, escolha outro dia.');
      }

      const limite = moment().add(1, 'year').startOf('day');

      if (dataInformada.isBefore(moment(), 'day')) {
        return bot.sendMessage(chatId, '⛔ A data informada já passou. Envie uma data futura.');
      }

      if (dataInformada.isAfter(limite)) {
        return bot.sendMessage(chatId, '📅 Só é possível agendar até 1 ano a partir de hoje. Envie uma data mais próxima.');
      }
      
      state.date = text;
      state.step = 'ask_time';
      
        // Buscar horários disponíveis
      try {
        const agendamentos = await Agendamento.find({ data: state.date });
        const horariosOcupados = agendamentos.map(a => a.horario);
      
        const todosHorarios = ['09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00'];
        const horariosDisponiveis = todosHorarios.filter(h => !horariosOcupados.includes(h));
      
        if (horariosDisponiveis.length === 0) {
          return bot.sendMessage(chatId, `😓 Não há horários disponíveis para ${state.date}. Por favor, escolha outra data.`);
        }
      
        bot.sendMessage(chatId, `⏳ *Horários disponíveis para ${state.date}:*\n\n🕒 ${horariosDisponiveis.join('\n🕒 ')}\n\nDigite o horário desejado (formato HH:MM):`, {
          parse_mode: 'Markdown'
        });
      } catch (error) {
        console.error('Erro ao buscar horários disponíveis:', error);
        bot.sendMessage(chatId, '⚠️ Erro ao verificar horários disponíveis. Tente novamente mais tarde.');
      }
      
      break;

      case 'ask_time':
        if (!moment(text, 'HH:mm', true).isValid()) {
          return bot.sendMessage(chatId, '⏰ Horário inválido. Use o formato HH:MM.');
        }
      
        const horarioInformado = moment(`${state.date} ${text}`, 'DD/MM/YYYY HH:mm');
      
        if (horarioInformado.isBefore(moment())) {
          return bot.sendMessage(chatId, '⛔ Esse horário já passou. Envie um horário futuro.');
        }
      
        const hora = horarioInformado.hour();
        if (hora < 9 || hora > 16) {
          return bot.sendMessage(chatId, '🕘 Nosso horário de atendimento é das 09:00 às 16:00. Por favor, escolha um horário dentro desse intervalo.');
        }
      
        state.time = text;
        state.step = 'done';

        const resumo = `✅ *Agendamento confirmado!*\n
          📛 Nome: ${state.name}
          📱 WhatsApp: ${state.phone}
          🛠️ Serviço: ${state.service}
          💰 Valor: R$ ${state.price.toFixed(2)}
          📅 Data: ${state.date}
          ⏰ Horário: ${state.time}`;

        bot.sendMessage(chatId, resumo, { parse_mode: 'Markdown' });

      try {
        await adicionarAgendamento({
          nome: state.name,
          servico: state.service,
          data: state.date,
          horario: state.time,
          valor: state.price // ✅ adicionando o preço
        });
      
        await Agendamento.create({
          nome: state.name,
          telefone: state.phone,
          servico: state.service,
          data: state.date,
          horario: state.time,
          valor: state.price // ✅ adicionando o preço
        });
    
      await enviarWhatsapp(state.phone, `Olá ${state.name}, seu agendamento para ${state.service} (R$ ${state.price}) está confirmado para ${state.date} às ${state.time} 💈`);

      const [dia, mes, ano] = state.date.split('/');
      const [hora, minuto] = state.time.split(':');
      const dataAgendada = new Date(ano, mes - 1, dia, hora, minuto);
      const lembrete = new Date(dataAgendada.getTime() - 60 * 60 * 1000);

      schedule.scheduleJob(lembrete, () => {
        bot.sendMessage(chatId, `🔔 Olá ${state.name}! Lembrete: seu horário na Barbearia X é às ${state.time} do dia ${state.date}. Até logo! 💈`);
      });

    } catch (error) {
      console.error('❌ Erro ao finalizar agendamento:', error);
      bot.sendMessage(chatId, '⚠️ Ocorreu um erro ao salvar seu agendamento. Por favor, tente novamente.');
    }

    delete userStates[chatId];
    break;

    // -------------------------------

    case 'cancel_nome':
      state.name = text;
      state.step = 'cancel_data';
      bot.sendMessage(chatId, '📅 Informe a *data do agendamento* que deseja cancelar (formato DD/MM/AAAA):', { parse_mode: 'Markdown' });
      break;

    case 'cancel_data':
      if (!moment(text, 'DD/MM/YYYY', true).isValid()) {
        return bot.sendMessage(chatId, '❌ Data inválida. Use o formato DD/MM/AAAA.');
      }
      state.date = text;
      state.step = 'cancel_time';
      bot.sendMessage(chatId, '⏰ Informe o *horário do agendamento* que deseja cancelar (formato HH:MM):', { parse_mode: 'Markdown' });
      break;

    case 'cancel_time':
      if (!moment(text, 'HH:mm', true).isValid()) {
        return bot.sendMessage(chatId, '❌ Horário inválido. Use o formato HH:MM.');
      }
      state.time = text;

      try {
        // Primeiro remover do MongoDB
        const agendamentoMongo = await Agendamento.findOneAndDelete({
          nome: state.name,
          data: state.date,
          horario: state.time
        });

    // Depois remover do Google Sheets
        const agendamentoSheet = await removerAgendamento(state.name, state.date, state.time);

        if (agendamentoMongo && agendamentoSheet) {
          bot.sendMessage(chatId, `✅ Agendamento de *${state.name}* para *${state.date} às ${state.time}* cancelado com sucesso dos dois sistemas!`, { parse_mode: 'Markdown' });
        } else if (agendamentoMongo && !agendamentoSheet) {
          bot.sendMessage(chatId, `⚠️ Agendamento de *${state.name}* removido apenas do *sistema interno* (MongoDB). Não foi encontrado na planilha.`, { parse_mode: 'Markdown' });
        } else if (!agendamentoMongo && agendamentoSheet) {
          bot.sendMessage(chatId, `⚠️ Agendamento de *${state.name}* removido apenas da *planilha*. Não foi encontrado no sistema interno (MongoDB).`, { parse_mode: 'Markdown' });
        } else {
          bot.sendMessage(chatId, '❌ Agendamento não encontrado em nenhum sistema. Verifique se as informações estão corretas.');
        }
      } catch (error) {
        console.error('Erro ao cancelar agendamento:', error);
        bot.sendMessage(chatId, '⚠️ Ocorreu um erro ao cancelar o agendamento. Tente novamente.');
      }

      delete userStates[chatId];
      break;

  }
});

