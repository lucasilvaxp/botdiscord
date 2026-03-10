# Bot de Matchmaking para Discord

Este bot Discord, desenvolvido em Node.js com a biblioteca Discord.js v14, oferece um sistema completo de matchmaking para organizar partidas entre usuários. Ele inclui um sistema de filas interativo, sorteio de times, criação dinâmica de canais de voz e texto, movimentação automática de jogadores e um painel de controle para gerenciar a partida. O sistema segue padrões profissionais com lógica de capitães e confirmação dupla de resultados.

## Funcionalidades

*   **Sistema de Fila:** Comandos `!fila 2v2`, `!fila 3v3`, `!fila 4v4` que criam uma embed interativa com botões para entrar, sair e cancelar a fila.
*   **Sorteio de Times:** Utiliza o algoritmo de Fisher-Yates para embaralhar os jogadores e dividi-los em dois times equilibrados.
*   **Canais Dinâmicos:** Cria uma categoria privada, um canal de texto e dois canais de voz (`🔊 Time 1` e `🔊 Time 2`) exclusivos para a partida.
*   **Movimentação de Jogadores:** Move automaticamente os jogadores para os canais de voz de seus respectivos times.
*   **Painel de Controle da Partida:** Um menu interativo no canal de texto da partida para setar o vencedor, votar no MVP e encerrar a partida, deletando todos os canais relacionados.

## Pré-requisitos

*   Node.js v16.x ou superior
*   Conta Discord e um servidor onde você tenha permissões de administrador.
*   Um aplicativo de bot Discord criado no [Portal do Desenvolvedor Discord](https://discord.com/developers/applications).

## Configuração

1.  **Clone o repositório:**
    ```bash
    git clone https://github.com/lucasilvaxp/arenasportswear.git
    cd arenasportswear
    ```

2.  **Instale as dependências:**
    ```bash
    npm install
    ```

3.  **Configure o arquivo `.env`:**
    Renomeie `.env.example` para `.env` e preencha com suas credenciais do bot:
    ```
    DISCORD_TOKEN=SEU_TOKEN_DO_BOT
    CLIENT_ID=SEU_CLIENT_ID_DO_BOT
    GUILD_ID=ID_DO_SEU_SERVIDOR_DISCORD
    ```
    *   **DISCORD_TOKEN:** O token do seu bot Discord. Você pode encontrá-lo no Portal do Desenvolvedor, na seção do seu aplicativo, em 'Bot'.
    *   **CLIENT_ID:** O ID do cliente do seu aplicativo Discord. Encontrado na seção 'General Information'.
    *   **GUILD_ID:** O ID do servidor (guild) onde o bot será utilizado. Para obter o ID do servidor, ative o Modo Desenvolvedor no Discord (Configurações de Usuário > Avançado) e clique com o botão direito no ícone do seu servidor.

4.  **Permissões do Bot:**
    Certifique-se de que seu bot tenha as seguintes permissões no servidor:
    *   `Manage Channels` (Gerenciar Canais)
    *   `Move Members` (Mover Membros)
    *   `View Channel` (Ver Canal)
    *   `Send Messages` (Enviar Mensagens)
    *   `Read Message History` (Ler Histórico de Mensagens)
    *   `Connect` (Conectar - para canais de voz)
    *   `Speak` (Falar - para canais de voz)

## Como Executar

### Localmente

Para iniciar o bot localmente, execute o seguinte comando no terminal na pasta raiz do projeto:

```bash
node index.js
```

### Deploy na Discloud

Este projeto já inclui o arquivo `discloud.config` configurado para facilitar o deploy na plataforma [Discloud](https://discloudbot.com/).

1.  Certifique-se de que todos os arquivos do projeto (incluindo `discloud.config`) estejam em um arquivo `.zip`.
2.  Faça o upload do arquivo `.zip` no painel da Discloud ou via comando no terminal se estiver usando a CLI deles.
3.  Configure as variáveis de ambiente (`DISCORD_TOKEN`, etc.) diretamente no painel da Discloud.

**Configurações do `discloud.config`:**
*   **RAM:** 100MB (suficiente para este bot em memória).
*   **MAIN:** `index.js`.
*   **AUTORESTART:** Ativado.

## Uso

### Comandos de Fila

*   `!fila 2v2`: Abre uma fila para partidas 2 contra 2.
*   `!fila 3v3`: Abre uma fila para partidas 3 contra 3.
*   `!fila 4v4`: Abre uma fila para partidas 4 contra 4.

### Interações na Fila

Após usar um comando `!fila`, uma mensagem embed será enviada com os seguintes botões:

*   **Entrar na Fila:** Adiciona o usuário à fila.
*   **Sair:** Remove o usuário da fila.
*   **Cancelar Fila:** Cancela a fila (apenas para moderadores ou quem abriu a fila).

Quando a fila estiver cheia, a partida será iniciada automaticamente.

### Painel de Controle da Partida

No canal de texto da partida, você encontrará uma mensagem com os seguintes botões:

*   **Setar Vencedor:** Abre um menu de seleção para escolher qual time venceu a partida.
*   **MVP:** Abre um menu de seleção para votar no MVP (Most Valuable Player) da partida.
*   **Encerrar Partida:** Deleta a categoria e todos os canais de voz e texto criados para a partida.

## Estrutura do Projeto

```
matchmaking-bot/
├── .env.example
├── index.js
├── package.json
├── package-lock.json
└── src/
    ├── commands/
    │   └── fila.js
    ├── events/
    │   └── interactionCreate.js
    ├── managers/
    │   └── queueManager.js
    └── utils/
        └── matchmaking.js
```

## Notas do Desenvolvedor

*   O gerenciamento de filas é feito em memória usando `discord.js.Collection`. Em um ambiente de produção, considere usar um banco de dados para persistência dos dados.
*   O tratamento de erros para movimentação de jogadores (`member.voice.setChannel`) já inclui um `catch` para evitar falhas caso o jogador não esteja em um canal de voz.
*   As permissões dos canais criados são configuradas para garantir a privacidade da partida, permitindo que apenas os jogadores e moderadores vejam e interajam.

---

**Lucas Ferreira Da Silva**
