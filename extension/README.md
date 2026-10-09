# Cerberus Vault — extensão beta

Extensão Manifest V3 para Chrome e Edge. Ela cria e administra o próprio cofre,
gera backups totalmente criptografados e preenche somente após clique no popup.

## Instalação

1. Baixe e extraia o pacote `cerberus-vault-extension-beta.zip`.
2. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
3. Ative o **Modo do desenvolvedor**.
4. Clique em **Carregar sem compactação** e selecione a pasta extraída.
5. Abra a extensão e clique em **Criar ou importar cofre**.
6. Crie uma senha mestra nova ou importe um backup.

Se você usava somente biometria, abra primeiro o aplicativo web, desbloqueie com
a biometria legada e defina uma nova senha mestra em **Configurações**. Depois,
exporte um novo backup e importe-o na extensão.

## Segurança da beta

- Todo o cofre permanece armazenado localmente e criptografado, inclusive sites, usuários e notas.
- A senha mestra fica apenas em `chrome.storage.session` enquanto desbloqueado.
- O cofre bloqueia automaticamente após cinco minutos.
- A extensão pede acesso somente à aba ativada pelo usuário.
- A credencial só é preenchida se o domínio atual corresponder exatamente ao cadastrado, ignorando apenas `www`.
- Backups da versão 3 podem ser criados e restaurados diretamente pela página de gerenciamento.
- Backups antigos da versão 2 são migrados após a senha correta ser informada.
- A biometria foi desativada até existir uma implementação que proteja a chave criptograficamente.

Não use esta versão beta com credenciais bancárias ou outras contas críticas.
