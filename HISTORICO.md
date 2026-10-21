# Histórico de ajustes — GOON OS

> Log das alterações feitas com o Claude Code. Mais recente no topo.

---

## 2026-10-23
- **Nome da ex-mentora removido de tudo** — aba "Fluxo" dela excluída do Financeiro; banco anonimizado (repasses, splits, conta corrente, reuniões, logs → "Ex-mentora"), valores mantidos pro fluxo passado bater. Código e docs sem o nome.
- **Saída da Ex-mentora (01/10/2026)** — nada repassado a ela em parcelas com vencimento ≥ 01/10.
  - 32 repasses MENTORIA previstos (out/26→jun/27, **R$94.673,66**) renomeados pra **Giulliano**; 32 débitos da conta corrente dela removidos.
  - Aba Repasses: `EX_MENTORA_EXIT` em `plans.service.getAllMentors` joga a fatia dela (≥ 01/10) na linha do Giulliano do plano. `PlanMentor` intacto.
  - Fluxo por sócio: despesas comuns 100% Giulliano a partir de out/26 (Ex-mentora 0%).
  - Mentorias TTS/TTSG → Giulliano (4 mentorados trocados + padrão no código).
  - **Segue devido à Ex-mentora:** 20 repasses previstos até set/26 (R$54.049,99), não mexidos.

## 2026-10-21
- **CRIS SEMI JOIAS** — devolução integral: 2 parcelas TTS (10/10 e 10/11) → CANCELLED, comissão pendente R$235 cancelada, plano TTS **CANCELADO**, cliente → PERDIDO/INACTIVE.
- **ARY NARAH** — cancelado: parcelas 20/10 e 20/11 → CANCELLED (4 pagas mantidas), plano TTS **CANCELADO**, cliente → PERDIDO/INACTIVE.
- **DITS** — cancelado: 2 parcelas TTS (23/10 e 23/11) → CANCELLED, plano TTS **CANCELADO**, cliente → PERDIDO/INACTIVE.
- **Zapone** — sai do TikTok: parcela TTS 26/10 → CANCELLED, plano TTS **CANCELADO** (26/09 paga mantida). Segue só no **GI** (11 parcelas nov/26–set/27).
- **Cynthia Durante** — parcela atrasada 09/10 → CANCELLED (não havia futuras), plano TTS **CANCELADO**, cliente → PERDIDO/INACTIVE. 09/09 paga mantida.
- **Andressa Polsse** — cliente cancelou: plano GI (R$30k) **CANCELADO**, 11 parcelas em aberto (2 vencidas set/out + 9 futuras) → CANCELLED (saem da lista de pagamentos). Cliente → **PERDIDO/INACTIVE**. Adesão paga (11/08) mantida.
- **A FIRMA** — carteira de cobrança: 3 vencidas (ago–out/26) → **99/99**, 6 futuras (nov/26–abr/27) → **98/98**, todas `inCarteira` (fora do fluxo e dos recebíveis). Plano segue ACTIVE (padrão Star Shop/Talamonte).

## 2026-10-15
- **CRM — lead "......." entrando a toda hora (Respondi).** Nome só de pontuação vira vazio na normalização, não tinha telefone/email → escapava do dedup e reentrava a cada sync. `isSpamLead` agora descarta nome sem letra/número. 21 leads lixo apagados do banco (+ histórico).
- **CRM — leads sumindo do kanban.** Estágios legados (`FOLLOW_UP`, `QUALIFICADO`→FUP, `PROPOSTA_ENVIADA`→EM_NEGOCIACAO, `RECUPERAR`→PERDIDO) normalizados no `findPipeline()` via `CrmService.normalizeStage()`.
  - **A fazer depois (opcional):** migrar os valores legados no banco.
- **Pendente:** CAMISARTE está como GOON ELITE, deveria ser TikTok Scale (aguardando ok).

---

## 2026-10-06
- **CyberBrand** — churn: parcela 02/10 removida, plano TTS **CANCELADO** (para a renovação auto), cliente → **PERDIDO/INACTIVE**. Parcela 02/09 paga mantida no histórico.
- **4F Minas (Leonardo)** — parcelas não pagas (R$2.500, out/26→mar/27) movidas do dia 03 → **dia 10**; `paymentDay` do plano = 10.
- **TTS recorrente (FEATURE)** — `payments.service.maybeRenewTTS()`: ao marcar uma parcela de plano **TTS ATIVO** como PAGA, cria automaticamente a próxima (mesmo valor, +1 mês), mantendo o "1+1" rolando. Vale no botão "Pagar" e na baixa via Pendências. Pra parar: mudar status do plano (ex.: COMPLETED).

## 2026-10-05
- **Barrière (Aline)** — vencimentos de **out/26 em diante movidos pro dia 25** (5/13 a 13/13); `paymentDay`=25.

## 2026-10-02 — Rodada grande de despesas/clientes
- **Antonela Social Selling** — set/26 marcada PAGA; 11 parcelas futuras (out/26→ago/27) removidas.
- **Jhon** — só setembro; 10 futuras (nov/26→ago/27) removidas.
- **Gestor de Tráfego (Thiago)** — R$1.200/mês de out/26→ago/27 (substitui o Jhon no tráfego).
- **Closer (Jana)** — 11 parcelas de R$3.000 movidas do dia 01 → **dia 10**.
- **Willy = "Wily"** (Editor/Filmaker, prestador) — 15/09 (R$6.000) mantida; 11 futuras removidas.
- **Inóbvia** — Advisor (GA) ajustado p/ **3× R$8.000** (R$24.000; splits João/Giu/Ex-mentora = R$7.520 cada; resta só 30/10). GOON Elite (R$2.076) — 11 parcelas reagendadas pra **28/11/26→28/09/27** (depois do Advisor).
- **Jana — comissão de setembro (A VALIDAR):** 10% sobre vendas a clientes NOVOS. 11 vendas = **R$80.000** → 10% bruto **R$8.000** / 10% líquido **R$7.520**. Pendências: (a) DITS (base) entra? (b) bruto ou líquido? (c) lançar como despesa?

## Rodada de vendas/splits (set/26)
- Novas vendas TTS: **Fiuju** (7.500), **Presence Jeans** (renovação 5.000), **DITS** (5.000), **Zapone** (5.000, venda ago/26), **Cris Semi Joias** (ajustado p/ 5.000 2×), **Lakre** (GI renovação 30.000 + TTS 5.000).
- **Splits 10/45/45** (João 10% / Ex-mentora 45% / Giu 45% do líquido) lançados nesses 7 planos.
- **Lakre** — GE antigo: canceladas parcelas R$1.000 out/nov/dez; GI renovação R$30k (12× R$2.500 de 08/10); venda do GI marcada em **setembro** (meta), financeiro em outubro.
- **Fiuju** — produto corrigido GE→**TTS**; plano duplicado (PIX) removido; parcelas 1.500/2.000/4.000.
- **Produtos em Acrílico** — venda cancelada → lead **EM_NEGOCIACAO**.
- **VVN Company** — removida por completo (não tinha contrato).
- **Body e Fit** — split ajustado: última parcela (15/09) 100% Giulliano (Giu 34.780 / Denis 21.620).
- **Velocímetro de meta** (Vendas + Dashboard) — passou a usar a **soma dos programas** (`goals-overview`), igual à aba Metas. Meta set = 42 (GE 2 + GI 10 + TTS 30).
- **Inóbvia / W Fitness** — faturamentos mensais preenchidos (mentoria).

## Features entregues (deployadas)
- **Landings públicas** (dark + neon, gravam lead no CRM):
  - `/masterclass` (evento; `/hotseat` redireciona). Capa MASTERCLASS · IA Aplicada · 24/09 · Richard Hey + Giulliano.
  - `/mentoria` (candidatura mentoria; origem `story_mentoria`, foto do Giulliano).
  - `/tiktok` (Social Commerce / agência oficial; origem `story_tiktok`; copy baseada no PDF TTK Scale).
  - Tag de origem por canal via `?c=` (default `story`). Rótulos no CRM.
  - Endpoint público `POST /api/public/event-lead` (dedup por e-mail/WhatsApp; faixa de faturamento classifica ICP).
  - **CORS** liberado p/ `*.goon-global.com` (main.ts + serverless) — domínio próprio já funciona.
- **Portal do cliente** `/portal/[token]` — 2 links por cliente: **Preencher** (métricas mensais) e **Meu painel** (read-only: evolução, KPIs, tarefas, reuniões). Tokens separados (`portalFillToken`/`portalPanelToken`); painel é read-only de verdade.
- **Despesas — Centro de custo** (GOON Global / Infinity / TikTok): schema `Expense.costCenter`, filtro, coluna, chips de resumo. 24 despesas de ago/set marcadas como TikTok. Upsert de métrica virou parcial.
- **Mentorados** — Visão Geral rica (gráfico interativo multi-métrica, lançamento rápido em massa, ranking c/ crescimento+sparkline); filtro de vigência (vigentes/vencidos/todos); ficha do cliente com KPIs clicáveis + gráfico + contexto editável; correção do "valor mais recente não-nulo" por métrica.

---

### Notas técnicas
- Deploy: Vercel (web `goon-os-web` auto; API `goon-os-api` serverless, confirmar via `/health`=200).
- Scripts de dados: `cd apps/api && npx tsx <arquivo>.ts` (Prisma via adapter Neon). Nunca `--force-reset/--accept-data-loss`.
- Split TTS/GI padrão: imposto 6% → **João 10% / Ex-mentora 45% / Giu 45%** do líquido.
- TTS: recorrente (1+1), cancelamento c/ 30 dias de aviso.
