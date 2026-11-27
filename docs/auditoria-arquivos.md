# Revisão do CoupleCare

## Página inicial

O tema claro da página pública aplicava um degradê de rosa, pêssego e lilás ao fundo e um degradê laranja aos botões principais. O navegador também podia restaurar um tema azul-escuro salvo em `cc-tema`.

- O fundo da página, o cabeçalho e a tela principal da demo usam branco no tema claro. Os botões principais usam roxo.
- O seletor continua aplicando a preferência escolhida. O modo escuro da página pública usa um fundo neutro, e a cor da interface do navegador acompanha a seleção.
- O FAQ, o checklist da demo e o convite final estavam ocultos pelo CSS. As três seções voltaram a aparecer.
- A página pública carrega seus próprios estilos em `src/css/landing.css` e `src/css/landing-showcase.css`, além da animação da marca. Sua paleta fica em `landing.css`.

## Código sem entrada ativa

Foram retirados dois pares de arquivos versionados depois de conferir as rotas, as importações e as referências no código.

- `src/script.js` e `src/js/script.js` tinham o mesmo manipulador de menu lateral, com uma diferença no nome da classe usada no mobile. As páginas atuais usam `src/js/figma-theme.js` para a navegação.
- `src/style.css` e `src/css/style.css` repetiam a lista de importações do layout antigo. Nenhuma página atual usa esses pontos de entrada.

## Outros candidatos à limpeza

- `src/css/tarefas-app.css`, `src/css/tarefas-orbital.css`, `src/js/calendar-extra.js`, `src/js/financas.js`, `src/js/finance-layout.js` e `src/js/utilidades.js` não têm referência nas páginas ou módulos ativos que foram examinados.
- `src/css/landing-intro.css` e `src/js/landing-intro.js` pertencem a uma introdução em vídeo que a página atual não carrega. `src/img/mockup-casa.webp` e `src/img/mockup-viagem.webp` também estão sem referência no código atual. Esses arquivos existem somente na cópia de trabalho.
- `assets/images/couplecare-logo-header.svg` e `assets/images/couplecare-logo-verde-claro.svg` têm conteúdo idêntico. O componente ativo da marca está em `src/js/couple-brand.js`. As duas URLs estáticas foram preservadas porque podem ser usadas fora do repositório.
- `assets/images/menu_icon.png` não tem referência nas rotas atuais.
- A área autenticada carrega `figma-theme.css`, `app.css`, `couple-glass.css`, `tema-couplecare.css`, `redesign-premium.css` e `mockup-fiel.css` em combinações que variam por página. Há regras sobrepostas de paleta, navegação e cartões. A consolidação dessas folhas exige conferir a cascata e o comportamento autenticado de cada página.

## Validação

O inventário final percorreu 135 arquivos. Foram conferidas 266 referências locais de HTML e CSS, incluindo as rotas da Vercel, sem destinos ausentes. Os HTMLs verificados não apresentaram IDs duplicados. A página inicial, seus arquivos de tema e as rotas principais responderam com HTTP 200 no servidor local. A checagem de sintaxe JavaScript, o teste isolado de alternância e persistência do tema e os três testes simulados da Pluggy passaram.

A revisão foi feita na cópia local. O navegador de teste não concluiu a renderização, então a conferência visual em desktop e mobile ficou pendente. A área autenticada e as integrações com banco, Pluggy e Pexels ainda precisam ser exercitadas com um ambiente de teste e dados reais.
