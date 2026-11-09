# Backlog — GOON OS

> Coisas paradas esperando decisão ou ação. Mais recente no topo.

---

## Agenda × Google Agenda (Workspace) — código pronto, não publicado
Ramo: `feat/google-agenda` (commit 45f237e). Fora do main porque muda o banco.

**O que faz:** reunião marcada no GOON entra na agenda Google do mentor com link do Meet;
mostra os compromissos do dia e avisa conflito; convite opcional ao cliente; grupo = 1 evento;
remarcar/cancelar/excluir acompanha. Config em Agenda > "Agendas Google".

**Para retomar:**
1. Trazer o ramo: `git merge feat/google-agenda` e `npm install` (google-auth-library).
2. Banco (só acrescenta): `cd apps/api && npx prisma db push --skip-generate`
3. Publicar: `git push origin main`
4. Admin do Workspace:
   - console.cloud.google.com: projeto "GOON OS", ativar Google Calendar API.
   - Conta de serviço "goon-agenda" > Chaves > JSON.
   - admin.google.com > Segurança > Controles de API > Delegação em todo o domínio:
     ID do cliente (`client_id` do JSON) + escopo `https://www.googleapis.com/auth/calendar`.
5. Colocar o JSON em `GOOGLE_SERVICE_ACCOUNT_JSON` no Vercel (goon-os-api) e redeploy.
6. Cadastrar e-mail do Workspace de cada mentor (Giulliano, João, Vaz) e usar "Testar".

## Pendências de decisão
- **Repasses de mentoria antes de out/26:** 40 lançamentos MENTORIA em aberto (R$ 93.178).
  Marcar todos como pagos ou só os com parcela do cliente paga?
- **Login teste@teste.com:** está em uso por alguém do time. Criar login individual antes de desativar.
- **Limpeza da stack (não executar sem ok):** remover scripts prisma antigos (`reimport.js` apaga o banco)
  e senhas de seed; `npm audit fix`; ignorar tsbuildinfo/.DS_Store; apagar ramo antigo.
- **CAMISARTE:** troca GE → TTS aguardando ok.
