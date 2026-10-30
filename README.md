# Marquinho Modas — arquivos para edição

Esta pasta contém o protótipo em arquivos separados. Preserve a estrutura ao editar ou hospedar esta versão:

- `index.html`: estrutura e textos das telas.
- `style.css`: aparência e comportamento responsivo.
- `carousel.css` e `carousel.js`: menu de categorias e cinco banners com controles de reprodução.
- `admin.css`: apresentação do painel, pedidos e contador de notificações.
- `data.js`: catálogo demonstrativo, preços em centavos e referências das fotos.
- `core.js`: validação de cadastro, carrinho, totais e endereço.
- `admin-core.js`: estados e transições dos pedidos de teste.
- `app.js`: interações, cadastro local, checkout e painel.
- `assets/`: fotografias e registro das fontes utilizadas.

Para compartilhar com mais facilidade, use o **index.html único**, localizado um nível acima desta pasta. Essa versão incorpora estilos, scripts e imagens e deve ser regenerada após alterações nos arquivos de origem. Não edite apenas a versão empacotada se pretende continuar desenvolvendo o projeto.

## GitHub Pages

Envie o **index.html único** para a raiz do repositório, mantendo esse nome em letras minúsculas. Em **Settings → Pages**, escolha publicação a partir da branch usada e da pasta **/(root)**. Se optar por estes arquivos separados, envie o conteúdo completo desta pasta com `index.html` na raiz publicada, preservando `assets/` e todos os arquivos `.js` e `.css`.

Veja as [instruções oficiais de publicação](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site) e o documento `LEIA-ME.md` ao lado do arquivo único.

## Limites da prévia

Os cinco banners avançam automaticamente a cada 4 segundos, com passagem suave por transparência e setas nas laterais, sem botão de pausa. O site começa no topo em novas visitas e recargas. O acesso do lojista só aparece para a conta **halvz876@gmail.com**, após o login local, e o painel solicita a senha **admin123**. Se necessário, cadastre esse e-mail usando uma senha de teste escolhida por você. Sair da conta oculta os acessos e alertas; fechar o painel ou escolher **Sair** bloqueia o painel. São controles demonstrativos no código, sem autenticação no servidor. O painel reúne abas de pedidos e clientes, busca, filtros de situação e recebimento, além de indicadores por etapa.

Contas, sacola e pedidos são dados locais do navegador; não existe servidor nem sincronização entre aparelhos. O cadastro com senha é apenas demonstrativo. O painel não oferece uma barreira de acesso segura. Não há cobrança, reserva de estoque, envio de mensagens ou solicitação de entrega. O frete de R$ 15,00 é simulado.

Use dados fictícios. Para apresentar o fluxo sem preencher cadastro ou consultar CEP, use o perfil de demonstração e o endereço fictício. O cadastro com senha e a consulta de CEP devem ser conferidos em HTTPS ou servidor local, pois abrir arquivos diretamente pode limitar recursos do navegador.

Antes da apresentação final, obtenha fotos reais autorizadas, confirme informações dos produtos e dados da loja. Para produção, implemente autenticação e permissões no servidor, banco de dados, estoque, pedidos compartilhados e confirmação de pagamentos. A loja pode organizar entregas manualmente; integrações de motofrete ou corridas ficam para uma etapa própria.
