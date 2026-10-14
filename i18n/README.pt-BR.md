<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/howlden@5a825300d45710bd67a8134cb2591ac638670bca/assets/banner-dark.svg">
    <img src="https://cdn.jsdelivr.net/gh/kwy404/howlden@5a825300d45710bd67a8134cb2591ac638670bca/assets/banner.svg" width="880" alt="Banner do howlden: a loba Luna uiva no microfone do headset. Chat em grupo, voz e vídeo sem servidor, direto no navegador">
  </picture>
</p>

<h1 align="center">howlden: chat em grupo, voz e vídeo sem servidor, direto no navegador</h1>

<p align="center">
  <a href="https://github.com/kwy404/howlden/actions/workflows/ci.yml"><img src="https://github.com/kwy404/howlden/actions/workflows/ci.yml/badge.svg" alt="Status do CI do howlden"></a>
  <a href="https://github.com/kwy404/howlden/blob/main/LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-7c5cff" alt="Licença MIT"></a>
  <a href="https://kwy404.github.io/howlden/app/"><img src="https://img.shields.io/badge/abrir-o%20app-ff8a3d" alt="Abrir o howlden no navegador"></a>
  <img src="https://img.shields.io/badge/criptografia-ponta%20a%20ponta-3ee6a0" alt="Criptografia de ponta a ponta com WebRTC">
</p>

<p align="center">
  <a href="https://kwy404.github.io/howlden/app/"><b>Abrir um den</b></a> &middot;
  <a href="https://kwy404.github.io/howlden/">Site</a> &middot;
  <a href="https://kwy404.github.io/howlden/pt/chat-sem-cadastro.html">Chat sem cadastro</a> &middot;
  <a href="https://github.com/kwy404/howlden/blob/main/README.md">Read in English</a>
</p>

**O howlden é um chat em grupo gratuito e de código aberto que roda inteiro no navegador, com o layout que você já conhece dos apps de chat para jogos: dens (servidores), canais de texto, canais de voz, vídeo e compartilhamento de tela.** Não tem conta nem cadastro: você cria um perfil local (nome de usuário, avatar e uma chave de identidade gerada no seu aparelho). Você convida a turma com um link ou QR code, e tudo vai direto entre os navegadores por WebRTC, com criptografia de ponta a ponta. Nenhum servidor nosso vê suas mensagens, voz, vídeo ou arquivos. Um den comporta até 5 pessoas, ou só você e um amigo.

## Sumário

- [Abrir o app](#abrir-o-app)
- [Recursos](#recursos)
- [Como funciona o convite](#como-funciona-o-convite)
- [Por que é privado](#por-que-é-privado)
- [Limites, sem rodeios](#limites-sem-rodeios)
- [Rodar por conta própria](#rodar-por-conta-própria)
- [Desenvolvimento](#desenvolvimento)
- [Perguntas frequentes](#perguntas-frequentes)
- [Guias](#guias)
- [Mais de kwy404](#mais-de-kwy404)
- [Autor](#autor)
- [Licença](#licença)

## Abrir o app

Acesse **[kwy404.github.io/howlden/app](https://kwy404.github.io/howlden/app/)**, escolha um nome e um avatar, abra um den e mande um convite. Nada para baixar, sem e-mail, sem senha, sem número de telefone. Funciona no Chrome, Edge, Firefox e Safari atuais, no computador e no celular. Dá para instalar como app pelo navegador, e ele abre offline depois de carregado (as chamadas, claro, precisam de rede).

## Recursos

| | |
| --- | --- |
| **Dens** | Um espaço do grupo com canais de texto, canais de voz e lista de membros. Cada den é um círculo privado de até 5 pessoas. |
| **Canais de texto** | Negrito, itálico, tachado, spoiler, código, citações, listas e links. Menções, respostas, edição, exclusão e reações. |
| **Canais de voz** | Entre e fale. Um anel acende em volta de quem está falando. Mutar e ensurdecer a um clique. |
| **Vídeo e tela** | Ligue a câmera ou compartilhe uma janela, uma aba ou a tela inteira em qualquer canal de voz. |
| **Arquivos** | Solte um arquivo no chat e ele vai direto do seu navegador para os amigos. Nada é enviado para servidor nenhum. |
| **Perfil local** | Nome, avatar e um par de chaves de assinatura (Ed25519 quando o navegador suporta) criado no seu aparelho. Sua tag, como `luna#7c1f`, vem dessa chave. Proteja com PIN ou leve para outro aparelho com um backup criptografado. |
| **Convites** | Um link e um QR code de ida, um código de resposta de volta. Leitura pela câmera quando o navegador suporta, colar sempre funciona. |
| **Extras de privacidade** | Senha opcional do den para uma segunda camada de criptografia e uma impressão digital da conexão para comparar. |
| **Ajuda com a rede** | Explicação clara quando uma rede restrita bloqueia a conexão direta, e uma opção para usar seu próprio servidor TURN. |

## Como funciona o convite

Não existe servidor para apresentar vocês, então os amigos se apresentam: um link de ida, um código de volta.

1. **Mande um convite.** Clique em Convidar. O howlden coloca a oferta de conexão do WebRTC (comprimida com `deflate-raw` e escrita em base64url) num link e num QR code. Mande pelo mensageiro que você já usa, ou deixe o amigo escanear o QR.
2. **Receba o código de resposta.** O amigo abre o link e o navegador dele gera um código curto de resposta, também em link ou QR. Ele devolve do mesmo jeito.
3. **Uivem juntos.** Cole ou escaneie a resposta e pronto. Depois disso o howlden conecta o novato a todo o resto do den sozinho, pelas conexões criptografadas que já existem.

Quem convidou precisa aceitar o código de resposta, então um link vazado sozinho não basta para entrar.

## Por que é privado

- **Nenhum servidor nosso.** Não existe backend, banco de dados ou sistema de contas do howlden. Nenhum servidor nosso vê suas mensagens, voz, vídeo ou arquivos. O site e o app são arquivos estáticos no GitHub Pages.
- **Criptografado pelo WebRTC.** Toda conexão é criptografada de ponta a ponta com DTLS, e o áudio e o vídeo com SRTP. Isso vem embutido no navegador e não dá para desligar.
- **O STUN só faz uma pergunta.** Para achar um caminho, o navegador pergunta a um servidor STUN público qual é o seu endereço público. O STUN nunca vê suas conversas.
- **Relays não conseguem ler.** Quando uma rede restrita bloqueia o caminho direto, um relay TURN pode repassar o tráfego. Ele só repassa pacotes criptografados e não consegue lê-los.
- **Nada guardado online.** Perfil, configurações, dens e mensagens ficam no seu navegador.
- **Senha opcional.** Uma senha do den cria uma segunda camada: PBKDF2 gera uma chave AES-GCM, e só quem sabe a senha lê mensagens e arquivos.
- **Impressão digital.** Compare o código curto da conexão numa chamada: se os dois lados veem o mesmo código, ninguém está no meio.

Privado não é o mesmo que anônimo: os membros se conectam direto, então veem o endereço de rede uns dos outros. E a segurança ainda depende do seu aparelho e do seu navegador. Veja a [política de segurança](https://github.com/kwy404/howlden/blob/main/SECURITY.md).

## Limites, sem rodeios

- **Até 5 pessoas por den.** Num mesh completo cada um envia áudio e vídeo para cada um dos outros; para comunidades grandes, uma ferramenta com servidor é a escolha certa.
- **Todos precisam estar online.** Não há servidor guardando mensagens. Quando você volta, quem está online compartilha o que você perdeu.
- **NAT restrito dos dois lados** (algumas redes de empresa, escola, hotel e operadora móvel) pode bloquear a conexão direta. Aí é preciso um relay TURN, e o howlden avisa quando isso acontece.
- **Limpar os dados do navegador apaga o perfil**, a não ser que você tenha salvo um backup criptografado.

## Rodar por conta própria

O howlden é só arquivos estáticos. Sirva a pasta `docs/` em qualquer hospedagem estática com HTTPS (o navegador só libera microfone e câmera em páginas seguras):

```bash
git clone https://github.com/kwy404/howlden.git
cd howlden
npm install
npm run serve   # http://127.0.0.1:8080/ para testar localmente
```

## Desenvolvimento

| Comando | O que faz |
| --- | --- |
| `npm test` | Testes com Vitest dos módulos principais e do site |
| `npm run lint` | ESLint |
| `npm run rules` | Regras da casa: sem emoji, sem travessões, sem nomes de outros frameworks CSS |
| `npm run e2e` | Teste real de conexão entre dois navegadores |
| `npm run site` | Gera as páginas, guias, sitemap e arte do site |
| `npm run site:check` | Falha se o site estiver desatualizado ou com link quebrado |

Veja o [CONTRIBUTING.md](https://github.com/kwy404/howlden/blob/main/CONTRIBUTING.md).

## Perguntas frequentes

### Existe chat sem cadastro e sem conta?
Sim. O howlden não pede e-mail, senha nem telefone. Veja o guia [chat sem cadastro](https://kwy404.github.io/howlden/pt/chat-sem-cadastro.html).

### Dá para fazer chamada de voz pelo navegador sem baixar nada?
Dá. Abra o app, entre num canal de voz e permita o microfone. Veja [chamada de voz no navegador](https://kwy404.github.io/howlden/pt/chamada-de-voz-no-navegador.html).

### Existe alternativa ao Discord sem conta?
Para grupos pequenos e privados, sim. Não é feito para comunidades públicas grandes. Veja [alternativa ao Discord sem conta](https://kwy404.github.io/howlden/pt/alternativa-ao-discord-sem-conta.html).

### Por que a conexão falha?
Geralmente porque os dois lados estão atrás de NAT restrito. Adicione um servidor TURN nas configurações.

## Guias

- [Chat sem cadastro](https://kwy404.github.io/howlden/pt/chat-sem-cadastro.html)
- [Chamada de voz pelo navegador sem baixar nada](https://kwy404.github.io/howlden/pt/chamada-de-voz-no-navegador.html)
- [Alternativa ao Discord sem conta](https://kwy404.github.io/howlden/pt/alternativa-ao-discord-sem-conta.html)
- Em inglês: [todos os guias](https://kwy404.github.io/howlden/guides.html)

## Mais de kwy404

- [Monsoon](https://kwy404.github.io/monsoon/): CSS utilitário sem etapa de build.
- [Voodoo.js](https://kwy404.github.io/Voodoo.js/): atributos reativos e JSX em HTML puro.
- [filefinch](https://kwy404.github.io/filefinch/): envie arquivos peer to peer no navegador, sem servidor.
- [breakhound](https://kwy404.github.io/breakhound/): encontre bugs em bibliotecas JavaScript automaticamente.
- [vueleap](https://kwy404.github.io/vueleap/): migração de Vue 2 para Vue 3.
- [graphemely](https://kwy404.github.io/graphemely/): utilitários de string que respeitam grafemas.
- [numberparrot](https://kwy404.github.io/numberparrot/): leitura de números localizados.
- [edgegoat](https://kwy404.github.io/edgegoat/): entradas de casos extremos para testes.
- [cookieowl](https://kwy404.github.io/cookieowl/): consentimento de cookies para LGPD e GDPR.
- [installkite](https://kwy404.github.io/installkite/): deixe qualquer site instalável.
- [a11ymedic](https://kwy404.github.io/a11ymedic/): verificador de acessibilidade com correções exatas.
- [fontsketch](https://kwy404.github.io/fontsketch/): transforme sua letra numa fonte.
- [kastor](https://kwy404.github.io/kastor/): ORM em TypeScript para vários bancos de dados.

## Autor

Criado por **Alexandre Kohler** ([GitHub](https://github.com/kwy404) e [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

## Licença

[MIT](https://github.com/kwy404/howlden/blob/main/LICENSE) 2026 Alexandre Kohler
