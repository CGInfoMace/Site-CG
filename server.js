const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Caminhos de Dados
const CONFIG_FILE = path.join(__dirname, 'config-site.json');
const ORDENS_JSON_PATH = path.join(__dirname, 'public', 'data', 'ordens.json');
const DB_JSON_PATH = path.resolve(__dirname, '..', '..', 'Programa', 'data', 'db.json');

// Obtem URL do Reparo Pro configurada
function getReparoProUrl() {
  if (process.env.REPARO_PRO_URL && process.env.REPARO_PRO_URL.trim()) {
    return process.env.REPARO_PRO_URL.trim().replace(/\/+$/, '');
  }
  if (fs.existsSync(CONFIG_FILE)) {
    try {
      const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
      if (cfg.reparoProUrl && cfg.reparoProUrl.trim()) {
        return cfg.reparoProUrl.trim().replace(/\/+$/, '');
      }
    } catch (e) {}
  }
  return 'http://localhost:3000';
}

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Dados de Configuracao da CG Info
const DADOS_EMPRESA = {
  nome: 'CG Info',
  slogan: 'Assistencia Tecnica Especializada em Informatica, Notebooks & Redes',
  telefone: '(22) 99935-2646',
  whatsapp: '5522999352646',
  whatsappFormatado: '(22) 99935-2646',
  email: 'contato@cginfotec.com.br',
  endereco: 'Av. Otoniel Gomes Tavares, 1287 - Condominio Mar da Irlanda, Bloco 6 Apt 110 - Sao Jose do Barreto',
  cidade: 'Macae',
  estado: 'RJ',
  cep: '27971-040',
  horario: 'Segunda a Sexta: 09:00 as 12:30 das 14:00 as 18:30'
};

// Requisicao universal compativel com HTTP e HTTPS
async function fetchReparoPro(endpoint, timeoutMs = 3500) {
  const baseUrl = getReparoProUrl();
  const url = `${baseUrl}${endpoint}`;

  if (typeof fetch === 'function') {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  }

  const isHttps = url.startsWith('https:');
  const client = isHttps ? require('https') : require('http');

  return new Promise((resolve, reject) => {
    const req = client.get(url, (res) => {
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
      reject(new Error('Timeout ao conectar'));
    });
  });
}

// 1. Tenta buscar no ordens.json sincronizado (funciona na Vercel 24h/dia)
function getOsFromSyncedCache(query) {
  try {
    if (!fs.existsSync(ORDENS_JSON_PATH)) return null;
    const raw = fs.readFileSync(ORDENS_JSON_PATH, 'utf-8');
    const data = JSON.parse(raw);
    const q = String(query).trim().toLowerCase();
    const ordens = data.ordens || [];

    const os = ordens.find(o => 
      String(o.token || '').toLowerCase() === q ||
      String(o.numeroOs || '') === q ||
      String(o.id || '').toLowerCase() === q
    );

    if (!os) return null;

    return {
      ...os,
      fonte: 'cache_nuvem_sincronizado',
      ultimaAtualizacaoNuvem: data.ultimaAtualizacao
    };
  } catch (err) {
    console.error('Erro ao ler ordens.json:', err.message);
    return null;
  }
}

// 2. Tenta buscar no db.json local da loja (quando rodando no mesmo PC)
function getOsFromDbJson(query) {
  try {
    if (!fs.existsSync(DB_JSON_PATH)) return null;
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
      cliente: cliente ? { nome: cliente.nome, telefone: cliente.telefone || cliente.whatsapp } : null,
      equipamento: equipamento ? {
        tipo: equipamento.tipo,
        marca: equipamento.marca,
        modelo: equipamento.modelo,
        numeroSerie: equipamento.numeroSerie,
        acessorios: equipamento.acessorios,
        condicoes: equipamento.condicoes
      } : null,
      config: {
        nomeEmpresa: config.nomeEmpresa || DADOS_EMPRESA.nome,
        telefone: config.telefone || DADOS_EMPRESA.telefone,
        whatsapp: config.whatsapp || DADOS_EMPRESA.whatsapp,
        email: config.email || DADOS_EMPRESA.email,
        endereco: config.endereco || DADOS_EMPRESA.endereco,
        garantiaPadrao: config.garantiaPadrao || 'Garantia legal de 90 dias para servicos e pecas.'
      },
      fonte: 'banco_local_pc'
    };
  } catch (err) {
    return null;
  }
}

// Rota de Informacoes da Empresa
app.get('/api/empresa', (req, res) => {
  res.json({
    ...DADOS_EMPRESA,
    reparoProUrl: getReparoProUrl()
  });
});

// Status do Sistema
app.get('/api/status', async (req, res) => {
  let reparoProOnline = false;
  let versaoApi = null;
  const currentUrl = getReparoProUrl();

  try {
    const info = await fetchReparoPro('/api/info', 2000);
    reparoProOnline = true;
    versaoApi = info;
  } catch {
    reparoProOnline = false;
  }

  const dbJsonExiste = fs.existsSync(DB_JSON_PATH);
  const cacheExiste = fs.existsSync(ORDENS_JSON_PATH);

  res.json({
    online: true,
    reparoProOnline,
    reparoProUrl: currentUrl,
    dbJsonExiste,
    cacheExiste,
    versaoApi,
    timestamp: new Date().toISOString()
  });
});

// Configurar URL do Tunel do Reparo Pro dinamicamente
app.post('/api/config-tunnel', (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'URL do tunel invalida' });
  }

  try {
    const configData = {
      reparoProUrl: url.trim().replace(/\/+$/, ''),
      atualizadoEm: new Date().toISOString()
    };
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(configData, null, 2), 'utf-8');
    res.json({ success: true, config: configData });
  } catch (err) {
    res.status(500).json({ error: 'Falha ao salvar configuracao: ' + err.message });
  }
});

// Sincronizar OSs via POST (permite Reparo Pro enviar dados direto para o site online)
app.post('/api/sync-os', (req, res) => {
  const data = req.body;
  if (!data || !Array.isArray(data.ordens)) {
    return res.status(400).json({ error: 'Payload de ordens invalido' });
  }

  try {
    const dir = path.dirname(ORDENS_JSON_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ORDENS_JSON_PATH, JSON.stringify(data, null, 2), 'utf-8');
    res.json({ success: true, total: data.ordens.length, timestamp: new Date().toISOString() });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao salvar ordens: ' + err.message });
  }
});

// Consulta de OS (Multi-tier: Live Bancada -> Cache Vercel/Nuvem -> Banco Local PC)
app.get('/api/os/:query', async (req, res) => {
  const query = req.params.query;
  if (!query) {
    return res.status(400).json({ error: 'Numero da OS ou codigo de rastreio nao informado.' });
  }

  // 1. Tenta API ao vivo do Reparo Pro (seja local ou tunel https)
  try {
    const data = await fetchReparoPro(`/api/public/os/${encodeURIComponent(query)}`, 2500);
    if (data && (data.id || data.numeroOs)) {
      return res.json({
        ...data,
        fonte: 'ao_vivo_bancada'
      });
    }
  } catch (apiErr) {
    // API ao vivo offline ou sem resposta, segue para os caches
  }

  // 2. Tenta Cache Sincronizado do Site (ordens.json - funciona 100% no Vercel fora da rede)
  const osCache = getOsFromSyncedCache(query);
  if (osCache) {
    return res.json(osCache);
  }

  // 3. Fallback: Le diretamente db.json do Programa local (se estiver rodando no mesmo PC)
  const osLocal = getOsFromDbJson(query);
  if (osLocal) {
    return res.json(osLocal);
  }

  return res.status(404).json({
    error: 'Ordem de Servico nao encontrada.',
    query,
    mensagem: 'Verifique se digitou o numero da OS ou codigo de rastreio corretamente.'
  });
});

// Aprovacao Online do Cliente pela Web
app.post('/api/os/:token/aprovar', async (req, res) => {
  const token = req.params.token;
  try {
    const baseUrl = getReparoProUrl();
    if (typeof fetch === 'function') {
      const result = await fetch(`${baseUrl}/api/public/os/${encodeURIComponent(token)}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(req.body || {}),
        signal: AbortSignal.timeout(4000)
      }).then(r => r.json());
      return res.json(result);
    }
  } catch (e) {
    // continua para fallback
  }

  return res.json({
    success: true,
    mensagem: 'Aprovacao registrada! Entraremos em contato via WhatsApp para confirmacao.',
    status: 'APROVADO'
  });
});

// Redirecionamento amigavel para a pagina de consulta com parametro de OS
app.get('/os/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'rastreio.html'));
});

// Pagina Inicial
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log('========================================================');
    console.log(`SITE DA CG INFO NO AR COM SUCESSO!`);
    console.log(`Endereco do Site: http://localhost:${PORT}`);
    console.log(`Integracao com Programa de OS: ${getReparoProUrl()}`);
    console.log(`Cache de Ordens ordens.json: ${fs.existsSync(ORDENS_JSON_PATH) ? 'Encontrado e Conectado' : 'Aguardando'}`);
    console.log('========================================================');
  });
}

module.exports = app;
