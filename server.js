const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 3001;
const REPARO_PRO_URL = process.env.REPARO_PRO_URL || 'http://localhost:3000';
const DB_JSON_PATH = path.resolve(__dirname, '..', '..', 'Programa', 'data', 'db.json');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Dados de Configuração da CG Info
const DADOS_EMPRESA = {
  nome: 'CG Info',
  slogan: 'Assistência Técnica Especializada em Informática, Notebooks & Redes',
  telefone: '(22) 99935-2646',
  whatsapp: '5522999352646',
  whatsappFormatado: '(22) 99935-2646',
  email: 'contato@cginfotec.com.br',
  endereco: 'Av. Otoniel Gomes Tavares, 1287 - Condomínio Mar da Irlanda, Bloco 6 Apt 110 - São José do Barreto',
  cidade: 'Macaé',
  estado: 'RJ',
  cep: '27971-040',
  horario: 'Segunda a Sexta: 09:00 às 12:30 das 14:00 às 18:30',
  reparoProUrl: REPARO_PRO_URL
};

// Helper para fazer requisição HTTP simples com timeout
function fetchReparoPro(endpoint, timeoutMs = 2500) {
  return new Promise((resolve, reject) => {
    const url = `${REPARO_PRO_URL}${endpoint}`;
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(JSON.parse(data));
          } else {
            reject(new Error(`Status ${res.statusCode}: ${data}`));
          }
        } catch (err) {
          reject(err);
        }
      });
    });

    req.on('error', reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error('Timeout ao conectar com Reparo Pro'));
    });
  });
}

// Helper para ler diretamente do db.json caso o Reparo Pro não esteja rodando
function getOsFromDbJson(query) {
  try {
    if (!fs.existsSync(DB_JSON_PATH)) {
      return null;
    }
    const raw = fs.readFileSync(DB_JSON_PATH, 'utf-8');
    const db = JSON.parse(raw);

    const q = String(query).trim().toLowerCase();
    const osList = db.ordens_servico || [];
    const os = osList.find(o => 
      String(o.token).toLowerCase() === q ||
      String(o.numeroOs) === q ||
      String(o.id).toLowerCase() === q
    );

    if (!os) return null;

    const cliente = (db.clientes || []).find(c => c.id === os.clienteId) || null;
    const equipamento = (db.equipamentos || []).find(e => e.id === os.equipamentoId) || null;
    const config = db.config || {};

    return {
      ...os,
      cliente,
      equipamento,
      config: {
        nomeEmpresa: config.nomeEmpresa || DADOS_EMPRESA.nome,
        telefone: config.telefone || DADOS_EMPRESA.telefone,
        whatsapp: config.whatsapp || DADOS_EMPRESA.whatsapp,
        email: config.email || DADOS_EMPRESA.email,
        endereco: config.endereco || DADOS_EMPRESA.endereco,
        garantiaPadrao: config.garantiaPadrao || 'Garantia legal de 90 dias para serviços e peças.'
      },
      fonte: 'banco_local'
    };
  } catch (err) {
    console.error('Erro ao ler db.json localmente:', err.message);
    return null;
  }
}

// Rota de Informações da Empresa
app.get('/api/empresa', (req, res) => {
  res.json(DADOS_EMPRESA);
});

// Status de Conexão com o Programa de OS
app.get('/api/status', async (req, res) => {
  let reparoProOnline = false;
  let versaoApi = null;
  
  try {
    const info = await fetchReparoPro('/api/info', 1500);
    reparoProOnline = true;
    versaoApi = info;
  } catch {
    reparoProOnline = false;
  }

  const dbJsonExiste = fs.existsSync(DB_JSON_PATH);

  res.json({
    online: true,
    reparoProOnline,
    dbJsonExiste,
    versaoApi,
    timestamp: new Date().toISOString()
  });
});

// Consulta de OS (com fallback automático)
app.get('/api/os/:query', async (req, res) => {
  const query = req.params.query;
  if (!query) {
    return res.status(400).json({ error: 'Número da OS ou código de rastreio não informado.' });
  }

  // 1. Tenta buscar direto na API do Reparo Pro se estiver rodando
  try {
    const data = await fetchReparoPro(`/api/public/os/${encodeURIComponent(query)}`);
    return res.json({
      ...data,
      fonte: 'reparo_pro_api'
    });
  } catch (apiErr) {
    // 2. Fallback: Lê diretamente o arquivo db.json do programa
    const osLocal = getOsFromDbJson(query);
    if (osLocal) {
      return res.json(osLocal);
    }

    return res.status(404).json({
      error: 'Ordem de Serviço não encontrada.',
      query,
      mensagem: 'Verifique se digitou o número da OS ou código corretamente.',
      detalhe: apiErr.message
    });
  }
});

// Redirecionamento amigável para a página de consulta com parâmetro de OS
app.get('/os/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rastreio.html'));
});

// Página Inicial
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('========================================================');
    console.log(`🚀 SITE DA CG INFO NO AR COM SUCESSO!`);
    console.log(`🌐 Endereço do Site: http://localhost:${PORT}`);
    console.log(`🔗 Integração com Programa de OS: ${REPARO_PRO_URL}`);
    console.log(`📁 Banco Local db.json: ${fs.existsSync(DB_JSON_PATH) ? 'Encontrado e Conectado' : 'Aguardando'}`);
    console.log('========================================================');
  });
}

module.exports = app;
