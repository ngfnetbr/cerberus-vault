# Cerberus Vault — extensão beta

Extensão Manifest V3 para Chrome e Edge. A instalação é manual e o preenchimento só acontece após o usuário clicar em uma credencial no popup.

## Instalação

1. No Cerberus Vault, clique em **Exportar** e salve o backup JSON completo.
2. Baixe e extraia o pacote `cerberus-vault-extension-beta.zip`.
3. Abra `chrome://extensions` no Chrome ou `edge://extensions` no Edge.
4. Ative o **Modo do desenvolvedor**.
5. Clique em **Carregar sem compactação** e selecione a pasta extraída.
6. Abra a extensão, importe o JSON e informe sua senha mestra.

Se você usava somente biometria, abra primeiro o aplicativo web, desbloqueie com
a biometria legada e defina uma nova senha mestra em **Configurações**. Depois,
exporte um novo backup e importe-o na extensão.

## Segurança da beta

- O cofre permanece armazenado localmente e criptografado.
- A senha mestra fica apenas em `chrome.storage.session` enquanto desbloqueado.
- O cofre bloqueia automaticamente após cinco minutos.
- A extensão pede acesso somente à aba ativada pelo usuário.
- A credencial só é preenchida se o domínio atual corresponder exatamente ao cadastrado, ignorando apenas `www`.
- A biometria foi desativada até existir uma implementação que proteja a chave criptograficamente.

Não use esta versão beta com credenciais bancárias ou outras contas críticas.
