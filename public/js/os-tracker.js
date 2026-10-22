/**
 * Rastreador de Ordem de Serviço - CG Info
 * Conexão com Reparo Pro & Fallback Inteligente
 */

// Configuração de Endpoints
const API_BASE = window.location.origin;
const REPARO_PRO_FALLBACK = 'http://localhost:3000';

// Elementos da Interface
let modalOs = null;
let modalContent = null;

document.addEventListener('DOMContentLoaded', () => {
  modalOs = document.getElementById('modal-os');
  modalContent = document.getElementById('modal-os-content');

  // Inicializa formulários de busca de OS
  initOsSearchForms();

  // Verifica se há parâmetro ?os= ou hash na URL para abrir direto
  checkUrlParamsForOs();
});

// Inicializa formulários na página
function initOsSearchForms() {
  // Formulário do Hero
  const heroForm = document.getElementById('form-busca-hero');
  if (heroForm) {
    heroForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('input-busca-hero');
      if (input && input.value.trim()) {
        consultarOs(input.value.trim());
      }
    });
  }

  // Formulário da Seção Dedicada de Rastreio
  const sectionForm = document.getElementById('form-busca-secao');
  if (sectionForm) {
    sectionForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('input-busca-secao');
      if (input && input.value.trim()) {
        consultarOs(input.value.trim());
      }
    });
  }

  // Fechar Modal
  const btnCloseModal = document.getElementById('btn-close-os-modal');
  if (btnCloseModal) {
    btnCloseModal.addEventListener('click', fecharModalOs);
  }

  if (modalOs) {
    modalOs.addEventListener('click', (e) => {
      if (e.target === modalOs) {
        fecharModalOs();
      }
    });
  }

  // Fechar com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOs && !modalOs.classList.contains('hidden')) {
      fecharModalOs();
    }
  });
}

// Verifica se há parâmetros na URL para consulta automática
function checkUrlParamsForOs() {
  const urlParams = new URLSearchParams(window.location.search);
  const osParam = urlParams.get('os') || urlParams.get('token') || urlParams.get('id');
  if (osParam) {
    consultarOs(osParam);
  } else {
    // Checa pelo path /os/:token
    const match = window.location.pathname.match(/\/os\/([^\/]+)/);
    if (match && match[1]) {
      consultarOs(match[1]);
    }
  }
}

// Abre o Modal com Carregamento
function abrirModalOs() {
  if (!modalOs) return;
  modalOs.classList.remove('hidden');
  modalOs.classList.add('flex');
  document.body.style.overflow = 'hidden';
}

// Fecha o Modal
function fecharModalOs() {
  if (!modalOs) return;
  modalOs.classList.add('hidden');
  modalOs.classList.remove('flex');
  document.body.style.overflow = 'auto';
}

// Exibe estado de carregamento dentro do modal
function renderLoadingState(query) {
  abrirModalOs();
  if (!modalContent) return;
  modalContent.innerHTML = `
    <div class="py-16 text-center space-y-4">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-4 border-cyan-500 border-t-transparent"></div>
      <h3 class="text-lg font-bold text-white">Consultando Ordem de Serviço #${query}...</h3>
      <p class="text-sm text-slate-400">Buscando informações em tempo real no banco do Reparo Pro...</p>
    </div>
  `;
}

// Exibe estado de erro
function renderErrorState(query, msg) {
  abrirModalOs();
  if (!modalContent) return;
  modalContent.innerHTML = `
    <div class="py-12 px-4 text-center max-w-lg mx-auto space-y-5">
      <div class="w-16 h-16 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto text-2xl">
        <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
      </div>
      <div>
        <h3 class="text-xl font-bold text-white mb-2">Ordem de Serviço Não Encontrada</h3>
        <p class="text-sm text-slate-400">Não localizamos nenhum registro para o termo "<strong class="text-slate-200">${query}</strong>".</p>
      </div>
      <div class="bg-slate-800/60 p-4 rounded-xl border border-slate-700/60 text-xs text-slate-400 text-left space-y-2">
        <p class="font-semibold text-slate-300">Dicas para localizar sua OS:</p>
        <ul class="list-disc list-inside space-y-1">
          <li>Digite apenas os dígitos numéricos (exemplo: <strong>538</strong>).</li>
          <li>Ou utilize o código impresso no seu comprovante (exemplo: <strong>83AIWF538</strong>).</li>
          <li>Verifique se o comprovante pertence à CG Info.</li>
        </ul>
      </div>
      <div class="flex flex-col sm:flex-row gap-3 justify-center pt-2">
        <button onclick="document.getElementById('input-busca-hero')?.focus(); fecharModalOs();" class="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-semibold transition">
          Tentar Novamente
        </button>
        <a href="https://wa.me/5522999352646?text=Ol%C3%A1%2C%20n%C3%A3o%20consegui%20localizar%20minha%20OS%20n%C3%BAmero%20${encodeURIComponent(query)}%20no%20site.%20Poderiam%20me%20ajudar%3F" target="_blank" class="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition inline-flex items-center justify-center gap-2">
          <span>Falar no WhatsApp</span>
        </a>
      </div>
    </div>
  `;
}

// Função Principal de Consulta
async function consultarOs(query) {
  const cleanQuery = String(query).trim();
  if (!cleanQuery) return;

  renderLoadingState(cleanQuery);

  let osData = null;

  // 1. Tenta API do próprio site Node.js
  try {
    const res = await fetch(`${API_BASE}/api/os/${encodeURIComponent(cleanQuery)}`);
    if (res.ok) {
      osData = await res.json();
    }
  } catch (e) {
    console.warn('API local do site não respondeu, tentando porta 3000...', e);
  }

  // 2. Fallback: Se o site estiver rodando estático ou sem backend, tenta direto o Reparo Pro em 3000
  if (!osData) {
    try {
      const resFallback = await fetch(`${REPARO_PRO_FALLBACK}/api/public/os/${encodeURIComponent(cleanQuery)}`);
      if (resFallback.ok) {
        osData = await resFallback.json();
      }
    } catch (fallbackErr) {
      console.warn('Fallback Reparo Pro porta 3000 falhou:', fallbackErr);
    }
  }

  // 3. Renderiza o resultado ou o erro
  if (osData && (osData.id || osData.numeroOs)) {
    renderOsDetails(osData);
  } else {
    renderErrorState(cleanQuery);
  }
}

// Mapeamento e Informações de Status
const STATUS_CONFIG = {
  RECEBIDO: {
    label: 'Equipamento Recebido',
    corClasse: 'status-recebido',
    badgeText: 'Recebido na Recepção',
    progresso: 1,
    descricao: 'Equipamento registrado na bancada e aguardando triagem técnica inicial.'
  },
  EM_ANALISE: {
    label: 'Em Análise Técnica',
    corClasse: 'status-em_analise',
    badgeText: 'Em Análise / Diagnóstico',
    progresso: 2,
    descricao: 'Técnico responsável executando testes e levantando laudo técnico.'
  },
  AGUARDANDO_APROVACAO: {
    label: 'Aguardando Aprovação',
    corClasse: 'status-aguardando_aprovacao',
    badgeText: 'Orçamento Pronto',
    progresso: 3,
    descricao: 'Diagnóstico concluído! Aguardando autorização do cliente para iniciar o reparo.'
  },
  APROVADO: {
    label: 'Orçamento Aprovado',
    corClasse: 'status-aprovado',
    badgeText: 'Aprovado - Na Fila',
    progresso: 4,
    descricao: 'Serviço autorizado. Equipamento em separação de peças para bancada.'
  },
  EM_REPARO: {
    label: 'Reparo em Andamento',
    corClasse: 'status-em_reparo',
    badgeText: 'Em Reparo na Bancada',
    progresso: 4,
    descricao: 'Técnico executando conserto, troca de componentes e testes de bancada.'
  },
  PRONTO_RETIRADA: {
    label: 'Pronto para Retirada',
    corClasse: 'status-pronto_retirada',
    badgeText: 'Pronto para Retirada',
    progresso: 5,
    descricao: 'Serviço concluído com 100% de sucesso e testes aprovados. Já pode ser retirado!'
  },
  FINALIZADO: {
    label: 'Finalizado e Entregue',
    corClasse: 'status-finalizado',
    badgeText: 'Entregue / Concluído',
    progresso: 6,
    descricao: 'Equipamento retirado pelo cliente com garantia ativada.'
  },
  REPROVADO: {
    label: 'Reprovado / Sem Reparo',
    corClasse: 'status-reprovado',
    badgeText: 'Orçamento Não Aprovado',
    progresso: 3,
    descricao: 'Orçamento reprovado pelo cliente ou equipamento sem viabilidade técnica.'
  }
};

// Formatação de Dinheiro
function formatarMoeda(val) {
  const num = parseFloat(val) || 0;
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Formatação de Data
function formatarData(dataIso) {
  if (!dataIso) return 'A definir';
  try {
    const d = new Date(dataIso);
    if (isNaN(d.getTime())) return dataIso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dataIso;
  }
}

// Renderiza os Detalhes da OS no Modal
function renderOsDetails(os) {
  abrirModalOs();
  if (!modalContent) return;

  const statusAtual = STATUS_CONFIG[os.status] || {
    label: os.status || 'Status Indefinido',
    corClasse: 'status-recebido',
    badgeText: os.status,
    progresso: 1,
    descricao: 'Acompanhando status do equipamento.'
  };

  const steps = [
    { num: 1, title: 'Entrada', desc: 'Recebido na CG Info' },
    { num: 2, title: 'Diagnóstico', desc: 'Análise Técnica' },
    { num: 3, title: 'Orçamento', desc: 'Aguardando Aprovação' },
    { num: 4, title: 'Reparo', desc: 'Execução e Testes' },
    { num: 5, title: 'Concluído', desc: 'Pronto para Retirar' }
  ];

  // Informações do Equipamento
  const equip = os.equipamento || {};
  const cliente = os.cliente || {};

  // Formata itens
  const itens = Array.isArray(os.itens) ? os.itens : [];
  let itensHtml = '';
  if (itens.length > 0) {
    itensHtml = itens.map(item => `
      <tr class="border-b border-slate-800 text-xs text-slate-300">
        <td class="py-2.5 px-3 font-medium text-white">${escapeHtml(item.descricao || 'Item de serviço')}</td>
        <td class="py-2.5 px-3 text-center">${item.quantidade || 1}</td>
        <td class="py-2.5 px-3 text-right">${formatarMoeda(item.valorUnitario || item.subtotal)}</td>
        <td class="py-2.5 px-3 text-right font-semibold text-cyan-400">${formatarMoeda(item.subtotal || ((item.quantidade || 1) * (item.valorUnitario || 0)))}</td>
      </tr>
    `).join('');
  } else {
    itensHtml = `
      <tr>
        <td colspan="4" class="py-4 text-center text-xs text-slate-500 italic">
          Nenhum item adicionado até o momento ou orçamento em elaboração.
        </td>
      </tr>
    `;
  }

  // Mensagem do WhatsApp
  const msgWhats = `Olá CG Info! Gostaria de falar sobre a Ordem de Serviço #OS-${os.numeroOs} (${equip.tipo || 'Equipamento'} ${equip.marca || ''} ${equip.modelo || ''}). Status: ${statusAtual.label}.`;
  const linkWhats = `https://wa.me/5522999352646?text=${encodeURIComponent(msgWhats)}`;

  // Link de Impressão Direta no Reparo Pro se disponível
  const linkImprimir = `${REPARO_PRO_FALLBACK}/imprimir/padrao/${os.id}`;

  modalContent.innerHTML = `
    <!-- Topo da OS -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
      <div>
        <div class="flex items-center gap-3">
          <span class="text-xs font-mono px-2.5 py-1 rounded bg-slate-800 text-cyan-400 font-bold border border-slate-700">
            OS #${os.numeroOs || os.id}
          </span>
          <span class="status-badge ${statusAtual.corClasse}">
            <span class="w-2 h-2 rounded-full bg-current animate-pulse"></span>
            ${statusAtual.badgeText}
          </span>
        </div>
        <h2 class="text-xl sm:text-2xl font-extrabold text-white mt-2">
          ${escapeHtml(equip.tipo || 'Equipamento')} ${escapeHtml(equip.marca || '')} ${escapeHtml(equip.modelo || '')}
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Código de Rastreio: <span class="font-mono text-slate-300 font-semibold">${os.token || os.id}</span> • Entrada: <strong>${formatarData(os.createdAt)}</strong>
        </p>
      </div>

      <div class="flex items-center gap-2 self-stretch sm:self-auto">
        <a href="${linkWhats}" target="_blank" class="flex-1 sm:flex-none px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30">
          <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.007c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.043.073.043.419-.101.824z"/></svg>
          <span>Falar com Técnico</span>
        </a>
        <button onclick="window.print()" class="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition" title="Imprimir Comprovante">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"/></svg>
        </button>
      </div>
    </div>

    <!-- Barra de Linha do Tempo / Timeline -->
    <div class="py-6 border-b border-slate-800">
      <div class="flex items-center justify-between mb-4">
        <span class="text-xs font-semibold text-slate-400 uppercase tracking-wider">Etapa do Atendimento</span>
        <span class="text-xs font-bold text-cyan-400">${statusAtual.descricao}</span>
      </div>
      
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-4">
        ${steps.map(step => {
          const isActive = statusAtual.progresso >= step.num;
          const isCurrent = statusAtual.progresso === step.num;
          return `
            <div class="p-3 rounded-xl border ${isActive ? 'bg-cyan-950/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-900/40 border-slate-800 text-slate-500'} ${isCurrent ? 'ring-2 ring-cyan-500 ring-offset-2 ring-offset-slate-900' : ''} transition">
              <div class="flex items-center gap-2">
                <span class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${isActive ? 'bg-cyan-500 text-slate-950' : 'bg-slate-800 text-slate-500'}">
                  ${isActive ? '✓' : step.num}
                </span>
                <span class="text-xs font-bold">${step.title}</span>
              </div>
              <p class="text-[11px] mt-1.5 opacity-80">${step.desc}</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    <!-- Grade de Detalhes Técnicos -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 py-6 border-b border-slate-800">
      <!-- Card Equipamento -->
      <div class="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
          Equipamento em Manutenção
        </h4>
        <div class="grid grid-cols-2 gap-3 text-xs">
          <div>
            <span class="text-slate-500 block">Tipo:</span>
            <span class="font-medium text-white">${escapeHtml(equip.tipo || 'Não informado')}</span>
          </div>
          <div>
            <span class="text-slate-500 block">Marca / Modelo:</span>
            <span class="font-medium text-white">${escapeHtml(equip.marca || '')} ${escapeHtml(equip.modelo || '')}</span>
          </div>
          <div>
            <span class="text-slate-500 block">Número de Série:</span>
            <span class="font-mono text-slate-300">${escapeHtml(equip.numeroSerie || 'Sem número gravado')}</span>
          </div>
          <div>
            <span class="text-slate-500 block">Previsão de Entrega:</span>
            <span class="font-semibold text-emerald-400">${formatarData(os.previsaoEntrega)}</span>
          </div>
        </div>
        ${equip.acessorios ? `
          <div class="pt-2 text-xs border-t border-slate-800/60">
            <span class="text-slate-500 block">Acessórios Deixados:</span>
            <span class="text-slate-300">${escapeHtml(equip.acessorios)}</span>
          </div>
        ` : ''}
      </div>

      <!-- Card Diagnóstico e Defeito -->
      <div class="bg-slate-900/60 p-5 rounded-2xl border border-slate-800/80 space-y-3">
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-2">
          <svg class="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
          Diagnóstico & Laudo Técnico
        </h4>
        <div class="space-y-2 text-xs">
          <div>
            <span class="text-slate-500 block font-medium">Defeito Relatado pelo Cliente:</span>
            <p class="text-slate-200 mt-0.5 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
              ${escapeHtml(os.defeitoRelatado || 'Defeito não informado no momento do cadastro')}
            </p>
          </div>
          <div>
            <span class="text-slate-500 block font-medium">Parecer / Laudo da CG Info:</span>
            <p class="text-cyan-300 mt-0.5 bg-cyan-950/20 p-2.5 rounded-lg border border-cyan-900/40 font-medium">
              ${escapeHtml(os.laudoTecnico || 'Equipamento em processo de análise técnica na bancada da CG Info.')}
            </p>
          </div>
        </div>
      </div>
    </div>

    <!-- Tabela de Peças e Serviços -->
    <div class="py-6 border-b border-slate-800 space-y-4">
      <div class="flex items-center justify-between">
        <h4 class="text-xs font-bold text-slate-400 uppercase tracking-wider">
          Peças e Serviços Discriminados
        </h4>
        <span class="text-xs text-slate-500">Valores em Reais (BRL)</span>
      </div>

      <div class="overflow-x-auto rounded-xl border border-slate-800">
        <table class="w-full text-left">
          <thead class="bg-slate-900 text-[11px] font-bold text-slate-400 uppercase border-b border-slate-800">
            <tr>
              <th class="py-2.5 px-3">Descrição do Serviço / Peça</th>
              <th class="py-2.5 px-3 text-center">Qtd</th>
              <th class="py-2.5 px-3 text-right">Unitário</th>
              <th class="py-2.5 px-3 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            ${itensHtml}
          </tbody>
        </table>
      </div>

      <!-- Resumo de Valores -->
      <div class="flex justify-end pt-2">
        <div class="w-full sm:w-64 bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-2 text-xs">
          <div class="flex justify-between text-slate-400">
            <span>Valor Total:</span>
            <span class="font-medium text-white">${formatarMoeda(os.valorTotal)}</span>
          </div>
          ${os.desconto > 0 ? `
            <div class="flex justify-between text-emerald-400">
              <span>Desconto:</span>
              <span>- ${formatarMoeda(os.desconto)}</span>
            </div>
          ` : ''}
          <div class="flex justify-between text-base font-extrabold text-white pt-2 border-t border-slate-800">
            <span>Total Final:</span>
            <span class="text-cyan-400">${formatarMoeda(os.valorFinal)}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Rodapé de Ações do Modal -->
    <div class="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div class="text-xs text-slate-400 flex items-center gap-2">
        <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/></svg>
        <span>Garantia legal de 90 dias com emissão de termo para serviços e peças trocadas.</span>
      </div>

      <div class="flex items-center gap-3 w-full sm:w-auto">
        <button onclick="fecharModalOs()" class="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition">
          Fechar Janela
        </button>
        <a href="${linkWhats}" target="_blank" class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold text-xs transition shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2">
          <span>Aprovar / Falar com Técnico</span>
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
        </a>
      </div>
    </div>
  `;
}

// Previne injeção de HTML
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
