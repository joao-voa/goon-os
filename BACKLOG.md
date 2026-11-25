# Backlog — GOON OS

> Coisas paradas esperando decisão ou ação. Mais recente no topo.

---

## Pendências de decisão
- **Repasses de mentoria antes de out/26:** 40 lançamentos MENTORIA em aberto (R$ 93.178).
  Marcar todos como pagos ou só os com parcela do cliente paga?
- **Login teste@teste.com:** está em uso por alguém do time. Criar login individual antes de desativar.
- **Limpeza da stack (não executar sem ok):** remover scripts prisma antigos (`reimport.js` apaga o banco)
  e senhas de seed; `npm audit fix`; ignorar tsbuildinfo/.DS_Store; apagar ramo antigo.
- **CAMISARTE:** troca GE → TTS aguardando ok.

## Assinatura automática da GOON na ClickSign (decidido deixar pra depois, 25/11/2026)
- Hoje o contrato vai por e-mail pro Giulliano (giullianopuga11@gmail.com) assinar junto com o cliente.
- Ideia: "Assinatura automática" da ClickSign v3 (auth `auto_signature`): termo único assinado pelo admin da conta e pelo
  Giulliano (POST /api/v3/auto_signature/terms com signer {name, email, documentation (CPF), birthday}, api_email, admin_email).
  Depois, o signatário GOON entra no envelope com requisito `auto_signature` e assina sozinho quando chega a vez dele.
- Pré-requisitos: conta PJ com Nome/CNPJ/Razão social em Configurações > Informações; CPF e nascimento do Giulliano.
  Confirmar se o plano libera e como criar o requisito (testar na API antes).

