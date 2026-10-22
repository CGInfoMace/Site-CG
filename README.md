# 🚀 Site Oficial CG Info & Portal de Acompanhamento de OS

Site moderno, responsivo e de alta conversão desenvolvido para a **CG Info** (Assistência Técnica Especializada em Informática, Notebooks, PCs Gamer, Placas-Mãe e Redes), com **vínculo direto ao programa de Ordem de Serviço (Reparo Pro)** para que os clientes acompanhem o status e laudo técnico do reparo do seu equipamento em tempo real.

---

## ✨ Principais Funcionalidades

1. **Divulgação Profissional dos Serviços**:
   - Reparo Avançado em Placas-Mãe (Microsolda, eliminação de curtos, gravação de BIOS).
   - Manutenção e Reparo de Notebooks (Telas, dobradiças, carcaças, teclados e conectores).
   - Montagem e Upgrades de PCs Gamer e Workstations com cable management profissional.
   - Limpeza Térmica Profunda (Troca de pasta térmica de alta condutividade e thermal pads).
   - Formatação limpa com Windows 11 Pro, remoção de vírus e recuperação de dados em HD/SSD.
   - Redes Estruturadas, Servidores, Wi-Fi corporativo e CFTV / Reconhecimento Facial.

2. **Vínculo com o Programa de Ordem de Serviço**:
   - **Busca Imediata na Página Inicial (Hero)** e em seção dedicada.
   - O cliente digita o **Número da OS** (ex: `538`) ou o **Código de Rastreio** (ex: `83AIWF538`).
   - O sistema consulta a API do programa **Reparo Pro** (`http://localhost:3000`).
   - **Fallback Inteligente**: Caso o programa não esteja aberto, o site lê diretamente o banco de dados `db.json` do Reparo Pro, garantindo que o cliente **nunca fique sem resposta**!
   - Linha do tempo interativa com as etapas:
     1. `Entrada / Recebido`
     2. `Em Análise / Diagnóstico Técnico`
     3. `Orçamento Pronto / Aguardando Aprovação`
     4. `Reparo em Andamento na Bancada`
     5. `Pronto para Retirada`
     6. `Entregue / Concluído com Garantia`
   - Exibição de laudo técnico, defeito relatado, peças e serviços discriminados e valores.
   - Botão direto para falar com o técnico no WhatsApp já com os dados da OS preenchidos.
   - Botão para imprimir comprovante.

3. **Página Dedicada de Rastreio (`/os/:token` ou `rastreio.html`)**:
   - Link limpo que pode ser impresso no QR Code do comprovante de entrega ou enviado direto no WhatsApp do cliente.

4. **Conversão e Contato**:
   - Botão flutuante do WhatsApp em todas as páginas com animação de pulso.
   - Formulário de pré-orçamento que formata a mensagem automaticamente para o WhatsApp.
   - Dúvidas Frequentes (FAQ) interativo.
   - Selos de confiança: Garantia de 90 dias, diagnósticos em bancada equipada com osciloscópio e microscópio.

---

## 🛠️ Como Iniciar o Site

### Opção 1: Pelo Atalho Rápido (Recomendado)
Dê um duplo clique no arquivo:
```
iniciar-site.bat
```
Ele iniciará o servidor e abrirá o site automaticamente no seu navegador padrão no endereço:
**`http://localhost:3001`**

### Opção 2: Pelo Terminal / Prompt de Comando
Abra a pasta `Site CG Info` no terminal e execute:
```bash
npm start
```

---

## 🔗 Como Funciona o Vínculo com o Programa de OS

- O **Reparo Pro** roda por padrão na porta `3000` (`http://localhost:3000`).
- O **Site CG Info** roda por padrão na porta `3001` (`http://localhost:3001`).
- Quando um cliente pesquisa uma OS (ex: `538`):
  1. O site solicita a informação ao endpoint `/api/os/538`.
  2. O backend do site consulta o Reparo Pro em tempo real.
  3. Se o Reparo Pro estiver fechado, o site busca diretamente no arquivo `Programa/data/db.json`.
  4. O resultado é formatado e exibido no modal moderno para o cliente.

---

## ⚙️ Personalização de Contatos e Dados

Se desejar alterar número de WhatsApp, telefone ou endereço:
1. Abra o arquivo `server.js` e altere o objeto `DADOS_EMPRESA`:
```javascript
const DADOS_EMPRESA = {
  nome: 'CG Info',
  telefone: '(22) 99935-2646',
  whatsapp: '5522999352646',
  ...
};
```
2. No arquivo `public/index.html` e `public/rastreio.html`, substitua o link `https://wa.me/5522999352646` pelo seu número oficial com DDD.

---

Desenvolvido para **CG Info - Tecnologia & Assistência Técnica**.
