//import { GoogleSpreadsheet } from 'google-spreadsheet';
//import { JWT } from 'google-auth-library';
/*const {GoogleSpreadsheet} = require('google-spreadsheet');
const {JWT} = require('google-auth-library');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function adicionarAgendamento({ nome, servico, data, horario, valor }) {
  try {
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);
    doc.auth = serviceAccountAuth;

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];

    await sheet.addRow({ nome, servico, data, horario, valor });

    console.log('✅ Agendamento adicionado com sucesso à planilha!');
  } catch (err) {
    console.error('❌ Erro ao adicionar agendamento na planilha:', err);
  }
}

async function removerAgendamento(nome, data, horario) {
  try {
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID);
    doc.auth = serviceAccountAuth;

    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    await sheet.loadHeaderRow();

    console.log(sheet.headerValues); // garantir que leu certo

    const rows = await sheet.getRows();

    rows.forEach((r, i) => {
      console.log(`Row ${i}:`, {
        nomePlanilha: r.nome,
        dataPlanilha: r.data,
        horarioPlanilha: r.horario,
      });
    });


    const headerIndex = {
      nome: sheet.headerValues.indexOf('nome'),
      servico: sheet.headerValues.indexOf('servico'),
      data: sheet.headerValues.indexOf('data'),
      horario: sheet.headerValues.indexOf('horario'),
      valor: sheet.headerValues.indexOf('valor'),
    };
    
    const row = rows.find(r => {
      const nomePlanilha = r._rawData[headerIndex.nome]?.trim().toLowerCase();
      const dataPlanilha = r._rawData[headerIndex.data]?.trim();
      const horarioPlanilha = r._rawData[headerIndex.horario]?.trim();
    
      const nomeEntrada = nome.trim().toLowerCase();
      const dataEntrada = data.trim();
      const horarioEntrada = horario.trim();
    
      return (
        nomePlanilha === nomeEntrada &&
        dataPlanilha === dataEntrada &&
        horarioPlanilha === horarioEntrada
      );
    });

    if (!row) {
      console.log('❌ Agendamento não encontrado na planilha.');
      return false;
    }

    await row.delete();
    console.log('✅ Agendamento removido da planilha com sucesso!');
    return true;

  } catch (err) {
    console.error('❌ Erro ao remover agendamento da planilha:', err);
    return false;
  }
}

export { adicionarAgendamento, removerAgendamento };

*/

const { GoogleSpreadsheet } = require('google-spreadsheet');
const { JWT } = require('google-auth-library');

const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

async function adicionarAgendamento({ nome, servico, data, horario, valor }) {
  try {
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    await sheet.addRow({ nome, servico, data, horario, valor });
    console.log('✅ Agendamento adicionado com sucesso à planilha!');
  } catch (err) {
    console.error('❌ Erro ao adicionar agendamento na planilha:', err);
  }
}

async function removerAgendamento(nome, data, horario) {
  try {
    const doc = new GoogleSpreadsheet(process.env.SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    const sheet = doc.sheetsByIndex[0];
    
    const rows = await sheet.getRows();
    const normalizedNome = nome.trim().toLowerCase();
    const normalizedData = data.trim();
    const normalizedHorario = horario.trim();

    const rowIndex = rows.findIndex(row => {
      return (
        row.get('nome')?.trim().toLowerCase() === normalizedNome &&
        row.get('data')?.trim() === normalizedData &&
        row.get('horario')?.trim() === normalizedHorario
      );
    });

    if (rowIndex === -1) {
      console.log('❌ Agendamento não encontrado na planilha.');
      return false;
    }

    await rows[rowIndex].delete();
    console.log('✅ Agendamento removido da planilha com sucesso!');
    return true;
  } catch (err) {
    console.error('❌ Erro ao remover agendamento da planilha:', err);
    return false;
  }
}

module.exports = { adicionarAgendamento, removerAgendamento };