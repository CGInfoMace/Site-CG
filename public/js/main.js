/**
 * Scripts Gerais de Interatividade - CG Info
 */

document.addEventListener('DOMContentLoaded', () => {
  initMobileMenu();
  initHeaderScroll();
  initFaqAccordion();
  initQuoteForm();
  checkSystemStatus();
});

// Menu Mobile
function initMobileMenu() {
  const btnToggle = document.getElementById('btn-mobile-menu');
  const mobileMenu = document.getElementById('mobile-menu');
  
  if (!btnToggle || !mobileMenu) return;

  btnToggle.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
  });

  // Fecha o menu ao clicar em qualquer link
  const links = mobileMenu.querySelectorAll('a');
  links.forEach(link => {
    link.addEventListener('click', () => {
      mobileMenu.classList.add('hidden');
    });
  });
}

// Efeito de Vidro no Header ao Rolar
function initHeaderScroll() {
  const header = document.getElementById('main-header');
  if (!header) return;

  window.addEventListener('scroll', () => {
    if (window.scrollY > 20) {
      header.classList.add('shadow-xl', 'bg-slate-950/90');
    } else {
      header.classList.remove('shadow-xl', 'bg-slate-950/90');
    }
  });
}

// Accordion de Dúvidas Frequentes (FAQ)
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');
  faqItems.forEach(item => {
    const btn = item.querySelector('.faq-button');
    const content = item.querySelector('.faq-content');
    const icon = item.querySelector('.faq-icon');

    if (!btn || !content) return;

    btn.addEventListener('click', () => {
      const isOpen = !content.classList.contains('hidden');
      
      // Fecha todos os outros
      document.querySelectorAll('.faq-content').forEach(c => c.classList.add('hidden'));
      document.querySelectorAll('.faq-icon').forEach(i => i.classList.remove('rotate-180'));

      if (!isOpen) {
        content.classList.remove('hidden');
        if (icon) icon.classList.add('rotate-180');
      }
    });
  });
}

// Formulário Rápido de Orçamento para o WhatsApp
function initQuoteForm() {
  const form = document.getElementById('form-orcamento-contato');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const nome = document.getElementById('orcamento-nome')?.value.trim() || 'Cliente';
    const tipo = document.getElementById('orcamento-tipo')?.value || 'Equipamento';
    const marcaModelo = document.getElementById('orcamento-modelo')?.value.trim() || 'Não especificado';
    const defeito = document.getElementById('orcamento-defeito')?.value.trim() || 'Manutenção geral';

    const texto = `*SOLICITAÇÃO DE ORÇAMENTO - CG INFO* 🛠️\n\n` +
      `👤 *Nome:* ${nome}\n` +
      `💻 *Equipamento:* ${tipo}\n` +
      `🏷️ *Marca/Modelo:* ${marcaModelo}\n` +
      `⚠️ *Problema/Defeito:* ${defeito}\n\n` +
      `_Gostaria de saber como procedo para trazer o equipamento para diagnóstico!_`;

    const zapUrl = `https://wa.me/5522999352646?text=${encodeURIComponent(texto)}`;
    window.open(zapUrl, '_blank');
  });
}

// Verifica status do sistema Reparo Pro
async function checkSystemStatus() {
  const statusBadge = document.getElementById('os-system-status');
  if (!statusBadge) return;

  try {
    const res = await fetch('/api/status');
    if (res.ok) {
      const data = await res.json();
      if (data.reparoProOnline || data.dbJsonExiste) {
        statusBadge.innerHTML = `
          <span class="w-2 h-2 rounded-full bg-emerald-400 animate-ping mr-1.5"></span>
          <span class="text-emerald-400 font-semibold">Sistema de OS Conectado</span>
        `;
        return;
      }
    }
  } catch {
    // Modo estático
  }

  statusBadge.innerHTML = `
    <span class="w-2 h-2 rounded-full bg-cyan-400 mr-1.5"></span>
    <span class="text-cyan-400 font-semibold">Portal de OS Ativo</span>
  `;
}
