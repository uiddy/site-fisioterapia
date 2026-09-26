# Revisão de segurança e responsividade — 26/09/2026

## Resultado

A suíte `npm test` passou em 14 dimensões de viewport no Chrome: 320×568, 360×640, 375×667, 390×844, 412×915, 568×320, 640×360, 768×1024, 820×1180, 1024×768, 1280×800, 1440×900, 1920×1080 e 2560×1440. Não foi detectado conteúdo visível ultrapassando horizontalmente essas telas.

As cinco verificações com axe-core (WCAG 2 A/AA e 2.1 AA) não encontraram violações automáticas nos estados testados: mobile, menu aberto, desktop, botão em hover e foto ampliada. Isso não equivale a uma certificação de acessibilidade.

`npm audit` retornou zero vulnerabilidades conhecidas nas dependências instaladas, todas usadas no desenvolvimento.

## Correções aplicadas

- Removido o JavaScript remoto do Tailwind; CSS gerado localmente e JavaScript próprio em arquivo separado.
- Política CSP restritiva, proteção explícita dos links que abrem outra aba, política de referência e integridade da folha de ícones.
- Contraste de textos e botões corrigido. Mantido o mesmo fundo verde nos botões de agendamento.
- Menu mobile identificado para leitores de tela, com estado aberto/fechado, área de toque mínima de 44px, fechamento por Esc e rolagem em telas baixas.
- Ajustados espaçamentos nos cartões, quebra das linhas de horários e distribuição dos benefícios em tablets.
- Foco mantido dentro da visualização ampliada e devolvido à foto após fechar; legenda apenas na foto da fisioterapeuta.
- Respeitada a preferência por movimento reduzido; incluído fallback de altura para navegadores sem unidades `dvh`.

## Verificações adicionais

Passaram os testes das cinco fotos, teclado, toque, rotação de celular com foto aberta, restauração de foco/rolagem, legendas tratadas como texto e bloqueio de script inline injetado pela CSP. O layout local e as interações básicas também funcionaram com os CDNs externos bloqueados. As fontes e parte dos ícones dependem desses serviços.

Foram revisadas visualmente capturas mobile da apresentação, benefícios, horários e rodapé. Os resultados detalhados e as capturas estão em `test-results/` após executar a suíte.

## Limites

A revisão cobre os arquivos locais e simulações no Chrome, não todos os navegadores ou aparelhos físicos. Não foi fornecido endereço de produção: certificados HTTPS, cabeçalhos de segurança da hospedagem, configuração do servidor e controles de infraestrutura não foram auditados. Veja `README.md` para manutenção, reprodução dos testes e orientações de publicação.
