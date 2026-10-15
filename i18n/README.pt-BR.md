<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://cdn.jsdelivr.net/gh/kwy404/howlden@5a825300d45710bd67a8134cb2591ac638670bca/assets/banner-dark.svg">
    <img src="https://cdn.jsdelivr.net/gh/kwy404/howlden@5a825300d45710bd67a8134cb2591ac638670bca/assets/banner.svg" width="880" alt="Banner do howlden: a loba Luna uiva no microfone do headset">
  </picture>
</p>

<h1 align="center">howlden</h1>

<p align="center">Chat em grupo, voz e vídeo entre navegadores, para até 5 amigos. Sem conta e sem servidor nosso no meio.</p>

<p align="center">
  <a href="https://github.com/kwy404/howlden/actions/workflows/ci.yml"><img src="https://github.com/kwy404/howlden/actions/workflows/ci.yml/badge.svg" alt="Status do CI"></a>
  <a href="https://github.com/kwy404/howlden/blob/main/LICENSE"><img src="https://img.shields.io/badge/licen%C3%A7a-MIT-7c5cff" alt="Licença MIT"></a>
</p>

<p align="center">
  <a href="https://kwy404.github.io/howlden/app/"><b>Abrir o app</b></a> &middot;
  <a href="https://kwy404.github.io/howlden/">Site</a> &middot;
  <a href="https://kwy404.github.io/howlden/pt/chat-sem-cadastro.html">Primeiros passos</a> &middot;
  <a href="https://github.com/kwy404/howlden/blob/main/README.md">English</a>
</p>

O howlden é um chat em grupo pequeno que roda inteiro no navegador: dens com canais de texto, canais de voz, vídeo e compartilhamento de tela. Você escolhe um nome e um avatar, passa seis palavras para um amigo e já estão conversando. Mensagens, chamadas e arquivos vão direto entre os navegadores por WebRTC, com criptografia de ponta a ponta.

## Começo rápido

1. Abra **[kwy404.github.io/howlden/app](https://kwy404.github.io/howlden/app/)** e escolha um nome e um avatar.
2. Crie um den e clique em **Convidar**. Leia as seis palavras para um amigo ou mande pelo mensageiro que vocês já usam.
3. Seu amigo digita as palavras e lê seis palavras de confirmação de volta. Digite, e vocês estão conectados.

Não precisa instalar nada. Funciona no Chrome, Edge, Firefox e Safari atuais, no computador e no celular, e dá para instalar como app pelo navegador.

## Recursos

- **Dens** com canais de texto, canais de voz e lista de membros, para até 5 pessoas.
- **Chat de texto** com formatação, respostas, menções, edição com histórico, reações e figurinhas da Luna que se animam ao chegar.
- **Tópicos, mensagens fixadas, enquetes e mensagens de voz**, além de busca com filtros, galeria de arquivos por canal, encaminhar e comandos como /poll e /roll.
- **Mensagens salvas e lembretes** guardados no seu aparelho, marcador de leitura e status que somem sozinhos.
- **Voz, vídeo e tela** nos canais de voz, com mudo, ensurdecer e supressão de ruído.
- **Ligar para um amigo** direto da tela inicial: um toque cria as seis palavras e abre o menu de compartilhar.
- **Apertar para falar**, com um botão grande de Segure para falar no celular.
- **Modo música**: sem filtros de ruído e eco, estéreo quando o aparelho tem, até 128 kbps.
- **Gravação local** da chamada, salva só no seu aparelho, com aviso e som para todos na chamada.
- **Arquivos** enviados direto de navegador para navegador.
- **Perfil local**: nome, avatar e uma chave de identidade criada no seu aparelho. Proteja com um PIN ou leve para outro aparelho com um backup criptografado.
- **Convite com seis palavras** e um QR code. Nenhum link para copiar, nada técnico para colar.
- **Privacidade extra**: frase secreta opcional no den e uma impressão digital da conexão para comparar.
- **Datas especiais**: no Halloween, Natal, Carnaval, Festa Junina e outras datas, a Luna e a turma se fantasiam, com figurinhas e reações da época. Um botão desliga tudo.

## Privacidade e limites

- Nenhum servidor nosso vê suas mensagens, voz, vídeo ou arquivos. O site e o app são arquivos estáticos.
- O WebRTC criptografa toda conexão com DTLS, e áudio e vídeo com SRTP.
- O handshake das seis palavras passa lacrado por relays MQTT públicos, que só veem texto cifrado.
- Perfil, configurações, dens e mensagens ficam no seu navegador. Limpar os dados do site apaga tudo, a menos que você tenha um backup.
- Privado não é anônimo: os membros de um den se conectam diretamente e podem ver o endereço de rede uns dos outros.
- Todo mundo precisa estar online ao mesmo tempo. Quem está online compartilha o que você perdeu.
- Com NAT restrito dos dois lados, é preciso um relay TURN. O howlden avisa em palavras simples e deixa você adicionar um nas configurações.

## Rodar por conta própria

O howlden é feito de arquivos estáticos. Sirva a pasta `docs/` em qualquer hospedagem estática com HTTPS (o navegador só libera microfone e câmera em páginas seguras):

```bash
git clone https://github.com/kwy404/howlden.git
cd howlden
npm install
npm run serve   # http://127.0.0.1:8080/
```

Os comandos de desenvolvimento estão no [README em inglês](https://github.com/kwy404/howlden/blob/main/README.md#development).

## Autor

Feito por **Alexandre Kohler** ([GitHub](https://github.com/kwy404), [LinkedIn](https://www.linkedin.com/in/alexandre-silva-173687256/)).

## Licença

[MIT](https://github.com/kwy404/howlden/blob/main/LICENSE) 2026 Alexandre Kohler
