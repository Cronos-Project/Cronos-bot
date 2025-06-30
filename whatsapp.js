const axios = require('axios');

async function enviarWhatsapp(numero, mensagem) {
  try {
    await axios.post('https://waba.360dialog.io/v1/messages', {
      to: numero,
      type: 'text',
      text: { body: mensagem },
    }, {
      headers: {
        'D360-API-KEY': process.env.WHATSAPP_TOKEN,
        'Content-Type': 'application/json',
      }
    });
    console.log('📲 WhatsApp enviado com sucesso!');
  } catch (error) {
    console.error('❌ Erro ao enviar WhatsApp:', error.message);
  }
}

module.exports = { enviarWhatsapp };
