# Notícias de Saúde — prévia editorial de 24/10/2026

Status: somente revisão e testes. Nenhuma alteração no Lumi Dev, produção, cron ou edição estática publicada.

## Regra proposta

1. Pesquisar e verificar primeiro os sites oficiais especializados em Parkinson: MJFF, Parkinson's Foundation, Parkinson's UK, APDA, Cure Parkinson's, Associação Parkinson Brasil e organizações equivalentes.
2. Só depois pesquisar saúde geral nacional e internacional global, em português e inglês.
3. Selecionar até 10 matérias, com Parkinson oficial primeiro e relevância editorial em seguida. Não completar a lista com material fraco ou duplicado.
4. Excluir assuntos regionais/locais mesmo quando publicados por um órgão nacional. O foco principal da matéria decide: dados nacionais em um texto sobre um estado não tornam a notícia nacional. Pesquisa feita numa instituição local pode ter alcance global.
5. Priorizar as últimas 24 horas. Limite adotado nesta prévia: sete dias, sempre com a data ORIGINAL verificada na fonte, exibida separadamente. A data de consulta não substitui publicação.
6. Resumos em português, nota editorial interna mínima 7/10 com motivo e evidência literal do alcance. Nota não é certificação externa.

## Teste com busca pública real

A consulta pública foi feita em duas etapas sequenciais, Parkinson oficial e depois saúde geral. Os exemplos abaixo foram abertos e conferidos manualmente. Não são uma edição completa de dez notícias nem uma execução autenticada de ponta a ponta da API de geração.

| Fonte / assunto | Publicação original | Decisão da prévia |
|---|---|---|
| OMS: indicadores globais de riscos do calor para gestantes e crianças | 21/10/2026 | Elegível para avaliação editorial: assunto global dentro de sete dias. |
| Ministério da Saúde: Farmácia Popular em municípios do Amazonas | 23/10/2026 | Excluído: foco estadual, mesmo contendo dados nacionais no corpo. |
| MJFF: tavapadon | 25/09/2026 | Excluído da janela desta prévia: publicação antiga, embora apareça em busca recente. |
| Ministério da Saúde: inscrições no Mais Médicos Especialistas | 21/10/2026 | Despriorizado: seleção profissional/administrativa, menor utilidade direta para o leitor. |

Fontes verificadas:

- https://www.who.int/news/item/21-10-2026-new-global-framework-launched-to-track-increasing-health-risks-of-extreme-heat-for-pregnant-women--newborns-and-children
- https://www.gov.br/saude/pt-br/assuntos/noticias-ms/2026/outubro/farmacia-popular-esta-presente-em-24-municipios-em-amazonas
- https://www.michaeljfox.org/news/fda-approves-tavapadon-parkinsons-motor-symptoms
- https://www.gov.br/saude/pt-br/assuntos/noticias-ms/2026/outubro/ministerio-da-saude-abre-inscricoes-para-nova-chamada-do-projeto-mais-medicos-especialistas

## Validação técnica

Comando: `node --test health-news-preview.test.mjs lumi-ativa-integration/tests/health-news-verification.test.mjs`

12 testes passaram. Cobertura: ordem sequencial das buscas, preferência Parkinson, limite dez, rejeição regional/alcance incerto, evidência ausente, nota insuficiente, duplicatas, data futura/antiga, retorno com menos de dez, proteção de URLs/redirecionamentos e ausência de gravações em KV.

O gerador de prévia reutiliza a chave de pesquisa existente somente no servidor e limita três pedidos à API e quarenta consultas às fontes. Os testes usam transporte simulado, sem chave real, custo de geração ou alteração de ambientes. O resultado tem `mode: review-only`, `published: false` e `automaticUpdates: false`.

## Antes de ativar

A função de prévia não está ligada às rotas, à interface nem ao cron atual. Depois da revisão do resultado, uma etapa separada poderá validar o gerador autenticado de ponta a ponta e adaptar o modo ao vivo da aba Notícias. A demonstração estática atual continua intacta.
