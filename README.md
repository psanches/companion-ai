# Companion AI v2

Aplicativo web/PWA simples de chat pessoal, feito para abrir no celular ou computador.

## Recursos
- Interface responsiva
- Histórico/memória local usando `localStorage`
- Funciona em modo demonstração sem servidor
- Pode ser instalado como PWA
- Opção experimental de conexão direta com a OpenAI API

## Publicar no GitHub Pages
1. Envie todos os arquivos para a raiz do repositório.
2. No GitHub: **Settings → Pages**.
3. Em **Build and deployment**, escolha **Deploy from a branch**.
4. Escolha `main` e `/ (root)` e salve.
5. Aguarde a publicação e abra o endereço mostrado pelo GitHub Pages.

## Segurança importante
Não coloque uma chave de API dentro de `app.js`, `README.md` ou qualquer arquivo enviado ao GitHub.

A opção de chave no navegador é adequada apenas para testes pessoais. Para uma versão pública/produção, use um backend/proxy seguro para que a chave nunca seja exposta ao navegador.

## Arquivos
- `index.html` — interface
- `style.css` — aparência
- `app.js` — chat, memória local e integração
- `manifest.json` — instalação como PWA
- `sw.js` — cache básico/offline
