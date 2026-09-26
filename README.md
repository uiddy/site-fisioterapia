# FisioCampos

Site estático preparado para publicação pela Vercel. A saída final fica em `public/`; o HTML carrega `styles.css` e `site.js` dessa mesma pasta. O CSS do Tailwind é gerado antes da publicação e nenhum JavaScript de terceiros é necessário para montar o layout.

## Editar e verificar

```sh
npm ci
npm run build
npm test
npm audit
```

- Edite o conteúdo em `public/index.html`, o comportamento em `public/site.js` e os estilos em `styles.source.css`.
- Depois de alterar estilos ou classes HTML/JavaScript, execute `npm run build` para atualizar `public/styles.css`.
- `tailwind.config.cjs` define as cores e fontes do projeto.
- Os testes usam Chrome instalado em `/usr/bin/google-chrome`. Para outro caminho, execute `BROWSER_PATH=/caminho/do/chrome npm test`.
- A suíte inicia e encerra seu próprio servidor local e navegador. Relatórios e capturas ficam em `test-results/`, que não é versionado.
- As fontes e ícones externos precisam de internet para o teste visual completo. A suíte também verifica o funcionamento básico com esses serviços bloqueados.

## Publicação

A Vercel executa `npm run build` e publica somente a pasta `public/`, conforme definido em `vercel.json`. Não é necessário publicar `node_modules`, testes, relatórios ou arquivos de configuração do build.

A política CSP no HTML restringe scripts a arquivos locais e bloqueia scripts inline. A folha de ícones usa verificação de integridade (SRI). Ao mudar recursos externos, revise a CSP e o hash correspondente.

HTTPS, HSTS, `X-Content-Type-Options: nosniff` e proteção contra incorporação em outros sites (`frame-ancestors` no cabeçalho HTTP CSP) dependem da hospedagem. Esses controles não foram validados em produção, pois a revisão foi realizada no projeto local. O resultado dos testes não substitui uma auditoria do servidor nem testes em aparelhos físicos.
