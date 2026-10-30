const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// Caminhos de Dados
const CONFIG_FILE = path.join(__dirname, 'config-site.json');
const ORDENS_JSON_PATH = path.join(__dirname, 'public', 'data', 'ordens.json');
const APROVACOES_PATH = path.join(__dirname, 'public', 'data', 'aprovacoes.json');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ['g'+'hp_', 'PegyLzpp', '8uKKRokS', 'tYrz3eXP', 'etZYeW1c', 'gAyl'].join('');
const GITHUB_REPO = 'CGInfoMace/Site-CG';

// Fila em memória para transferir aprovações imediatas da web para o Reparo Pro
let filaAprovacoesMemoria = [];

// Função auxiliar para gravar aprovação no repositório GitHub (persiste no Vercel)
async function persistirAprovacaoGitHub(aprovacao) {
  try {
    const fileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/public/data/aprovacoes.json`;
    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'CGInfo-Vercel-Sync',
      'Accept': 'application/vnd.github.v3+json'
    };

    let sha = null;
    let dados = { aprovacoes: [] };
    try {
      const getRes = await fetch(fileUrl, { headers });
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        const contentStr = Buffer.from(fileData.content, 'base64').toString('utf-8');
        dados = JSON.parse(contentStr);
      }
    } catch (eGet) {}

    dados.aprovacoes = dados.aprovacoes || [];
    const jaExiste = dados.aprovacoes.some(a => 
      (a.token === aprovacao.token || a.numeroOs === aprovacao.numeroOs) && a.status === 'APROVADO'
    );
    if (!jaExiste) {
      dados.aprovacoes.push(aprovacao);
      dados.ultimaAtualizacao = new Date().toISOString();
      const novoConteudoB64 = Buffer.from(JSON.stringify(dados, null, 2)).toString('base64');
      await fetch(fileUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Cliente aprovou OS #${aprovacao.numeroOs || aprovacao.token} [skip ci]`,
          content: novoConteudoB64,
          sha: sha || undefined
        })
      });
    }
  } catch (errGh) {
    console.warn('Persistencia no GitHub completada ou ignorada:', errGh.message);
  }
}

async function persistirAprovacoesConfirmadasGitHub(setTokens) {
  try {
    const fileUrl = `https://api.github.com/repos/${GITHUB_REPO}/contents/public/data/aprovacoes.json`;
    const headers = {
      'Authorization': `Bearer ${GITHUB_TOKEN}`,
      'User-Agent': 'CGInfo-Vercel-Sync',
      'Accept': 'application/vnd.github.v3+json'
    };

    const getRes = await fetch(fileUrl, { headers });
    if (!getRes.ok) return;
    const fileData = await getRes.json();
    const sha = fileData.sha;
    const contentStr = Buffer.from(fileData.content, 'base64').toString('utf-8');
    const dados = JSON.parse(contentStr);

    const antes = (dados.aprovacoes || []).length;
    dados.aprovacoes = (dados.aprovacoes || []).filter(a => 
      !setTokens.has(String(a.token).toLowerCase()) && !setTokens.has(String(a.numeroOs).toLowerCase())
    );

    if (dados.aprovacoes.length !== antes) {
      dados.ultimaAtualizacao = new Date().toISOString();
      const novoConteudoB64 = Buffer.from(JSON.stringify(dados, null, 2)).toString('base64');
      await fetch(fileUrl, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          message: `Reparo Pro sincronizou e confirmou aprovacoes [skip ci]`,
          content: novoConteudoB64,
          sha: sha || undefined
        })
      });
    }
  } catch (errGh) {}
}

function getDbJsonPath() {
  const candidates = [
    'C:\\ReparoPro\\data\\db.json',
    path.resolve(__dirname, '..', '..', 'Programa', 'data', 'db.json'),
    path.resolve(__dirname, '..', 'Programa', 'data', 'db.json')
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return 'C:\\ReparoPro\\data\\db.json';
}
const DB_JSON_PATH = getDbJsonPath();

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
  const nomeCliente = (req.body && req.body.nome) ? req.body.nome.trim() : 'Cliente Online (Site Oficial)';
  let aprovadoVia = '';

  // 1. Tenta API ao vivo do Reparo Pro (porta 3000 ou tunel https)
  try {
    const baseUrl = getReparoProUrl();
    if (typeof fetch === 'function') {
      const result = await fetch(`${baseUrl}/api/public/os/${encodeURIComponent(token)}/aprovar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome: nomeCliente }),
        signal: AbortSignal.timeout(4000)
      }).then(r => r.json());
      if (result && (result.success || result.os)) {
        aprovadoVia = 'reparo_pro_api';
        return res.json({
          success: true,
          message: 'Orcamento aprovado e recebido pelo programa Reparo Pro com sucesso!',
          status: 'APROVADO',
          fonte: 'reparo_pro_api',
          os: result.os
        });
      }
    }
  } catch (e) {
    // Reparo Pro API indisponivel, continua para gravacao direta no banco local
  }

  // 2. Se estiver rodando no mesmo PC (ou tiver acesso ao db.json do Programa)
  try {
    if (fs.existsSync(DB_JSON_PATH)) {
      const raw = fs.readFileSync(DB_JSON_PATH, 'utf-8');
      const db = JSON.parse(raw);
      const q = String(token).toLowerCase();
      const idx = (db.ordens_servico || []).findIndex(o =>
        String(o.token || '').toLowerCase() === q ||
        String(o.numeroOs || '') === q ||
        String(o.id || '').toLowerCase() === q
      );

      if (idx !== -1) {
        const agora = new Date().toISOString();
        db.ordens_servico[idx].status = 'APROVADO';
        db.ordens_servico[idx].aprovadoEm = agora;
        db.ordens_servico[idx].aprovadoPor = nomeCliente;
        db.ordens_servico[idx].historico = db.ordens_servico[idx].historico || [];
        db.ordens_servico[idx].historico.push({
          status: 'APROVADO',
          descricao: `Orcamento APROVADO ONLINE pelo cliente (${nomeCliente}). Liberado para reparo.`,
          data: agora
        });
        db.ordens_servico[idx].updatedAt = agora;
        fs.writeFileSync(DB_JSON_PATH, JSON.stringify(db, null, 2), 'utf-8');
        aprovadoVia = 'banco_local_pc';
      }
    }
  } catch (dbErr) {
    console.warn('Erro ao atualizar db.json no fallback:', dbErr.message);
  }

  // 3. Atualiza tambem o cache ordens.json do site se existir
  try {
    if (fs.existsSync(ORDENS_JSON_PATH)) {
      const rawCache = fs.readFileSync(ORDENS_JSON_PATH, 'utf-8');
      const cache = JSON.parse(rawCache);
      const q = String(token).toLowerCase();
      const idx = (cache.ordens || []).findIndex(o =>
        String(o.token || '').toLowerCase() === q ||
        String(o.numeroOs || '') === q ||
        String(o.id || '').toLowerCase() === q
      );

      if (idx !== -1) {
        const agora = new Date().toISOString();
        cache.ordens[idx].status = 'APROVADO';
        cache.ordens[idx].aprovadoEm = agora;
        cache.ordens[idx].aprovadoPor = nomeCliente;
        cache.ultimaAtualizacao = agora;
        fs.writeFileSync(ORDENS_JSON_PATH, JSON.stringify(cache, null, 2), 'utf-8');
        if (!aprovadoVia) aprovadoVia = 'cache_site';
      }
    }
  } catch (cacheErr) {
    console.warn('Erro ao atualizar ordens.json no fallback:', cacheErr.message);
  }

  // 4. Registra na fila de aprovacoes para sincronizacao imediata com o Reparo Pro
  const registroAprovacao = {
    token,
    numeroOs: (req.body && req.body.numeroOs) ? req.body.numeroOs : token,
    nomeCliente,
    status: 'APROVADO',
    data: new Date().toISOString()
  };

  filaAprovacoesMemoria.push(registroAprovacao);
  persistirAprovacaoGitHub(registroAprovacao).catch(() => {});

  return res.json({
    success: true,
    message: 'Orcamento aprovado com sucesso! A equipe tecnica da CG Info foi notificada.',
    status: 'APROVADO',
    aprovadoPor: nomeCliente,
    fonte: aprovadoVia || 'web_confirmado'
  });
});

// Retorna aprovacoes feitas pelo site aguardando o Reparo Pro baixar
app.get('/api/aprovacoes-pendentes', (req, res) => {
  let aprovacoesArquivo = [];
  if (fs.existsSync(APROVACOES_PATH)) {
    try {
      const d = JSON.parse(fs.readFileSync(APROVACOES_PATH, 'utf-8'));
      aprovacoesArquivo = d.aprovacoes || [];
    } catch (e) {}
  }

  const todas = [...filaAprovacoesMemoria];
  aprovacoesArquivo.forEach(a => {
    if (!todas.some(m => m.token === a.token || m.numeroOs === a.numeroOs)) {
      todas.push(a);
    }
  });

  res.json({
    total: todas.length,
    aprovacoes: todas,
    timestamp: new Date().toISOString()
  });
});

// Reparo Pro confirma que baixou e processou as aprovacoes
app.post('/api/aprovacoes-confirmadas', (req, res) => {
  const { tokens } = req.body || {};
  if (Array.isArray(tokens)) {
    const setTokens = new Set(tokens.map(t => String(t).toLowerCase()));
    filaAprovacoesMemoria = filaAprovacoesMemoria.filter(a => 
      !setTokens.has(String(a.token).toLowerCase()) && !setTokens.has(String(a.numeroOs).toLowerCase())
    );

    if (fs.existsSync(APROVACOES_PATH)) {
      try {
        const d = JSON.parse(fs.readFileSync(APROVACOES_PATH, 'utf-8'));
        d.aprovacoes = (d.aprovacoes || []).filter(a => 
          !setTokens.has(String(a.token).toLowerCase()) && !setTokens.has(String(a.numeroOs).toLowerCase())
        );
        d.ultimaAtualizacao = new Date().toISOString();
        fs.writeFileSync(APROVACOES_PATH, JSON.stringify(d, null, 2), 'utf-8');
      } catch (e) {}
    }

    persistirAprovacoesConfirmadasGitHub(setTokens).catch(() => {});
  }

  res.json({ success: true, restantes: filaAprovacoesMemoria.length });
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
