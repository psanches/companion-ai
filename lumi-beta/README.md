# Relatos do beta Lumi

Disponível apenas em `lumi-develop.psanchesnle.workers.dev`. No menu ☰, escolher **Relatar problema · Beta**.

| Código | Área |
| --- | --- |
| CAL | Agenda e eventos |
| LOG | Entrada e acesso |
| CHA | Conversa e respostas |
| VOZ | Áudio e microfone |
| MEM | Memória e histórico |
| SAU | Saúde e exercícios |
| TEL | Tela e navegação |
| PES | Pesquisa e notícias |
| OUT | Outro problema |

Cada envio recebe um protocolo único `LUM-ÁREA-AAAAMMDD-IDENTIFICADOR`. Código de área agrupa problemas semelhantes; protocolo identifica um relato específico, sem presumir que a causa já foi diagnosticada.

Campos: área, descrição, resultado esperado opcional, impacto (pequeno ajuste, atrapalha, impede continuar) e dispositivo. Inclui a versão publicada do app, sem anexar conversas, dados médicos do perfil, credenciais ou o user agent completo. Não há envio de e-mails ou abertura automática de issues públicas.

O servidor verifica a sessão Supabase e a origem antes de persistir os relatos criptografados na KV Memory, usando o segredo de servidor existente. O registro inclui o identificador autenticado do autor; ele nunca é aceito do formulário. Os relatos não expiram automaticamente. Cada participante consulta apenas os próprios relatos em **Meus relatos**, com paginação. Ao falhar o envio, o formulário conserva o texto. Uma repetição do mesmo envio conserva o protocolo e não cria um novo relato. Limite de 20 relatos por participante por dia UTC, sujeito à consistência eventual da KV.

Os registros são centralizados em `beta:report:<protocolo>` (conteúdo criptografado); `beta:user:<id>:<data>:<protocolo>` é o índice de consulta por autor. Não se deve conceder a participantes acesso à KV ou ao segredo. A interface atual não possui um painel administrativo de todos os participantes nem fluxo de alteração de status. Todos os envios ficam como **recebido**. A triagem consolidada deve ser feita por um operador autorizado; um painel de administração requer autorização explícita de contas antes de ser ativado.

Validação: testes de autenticação/origem, isolamento entre participantes, criptografia, persistência, repetição de envio, limites, erros de configuração, preservação do texto, renderização segura e retorno à Lumi.
