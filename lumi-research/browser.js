// Development-only research button. Original Lumi app.js is not changed.
(function () {
  const form = document.getElementById('chatForm');
  const input = document.getElementById('messageInput');
  const messages = document.getElementById('messages');
  if (!form || !input || !messages) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = 'lumiResearchBtn';
  button.textContent = '🔎 Pesquisar';
  button.title = 'Pesquisar na internet com fontes';
  button.style.cssText = 'margin:8px 0;padding:9px 13px;border-radius:10px;border:1px solid #7dd3fc;background:#243449;color:#fff;cursor:pointer';
  form.appendChild(button);
  const show = (message) => {
    const item = document.createElement('div');
    item.className = 'msg assistant';
    item.textContent = message;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
    return item;
  };
  button.addEventListener('click', async () => {
    const question = input.value.trim();
    if (!question || question.length > 1200) { show('Digite uma pergunta de até 1200 caracteres.'); return; }
    button.disabled = true;
    const pending = show('Lumi está pesquisando fontes verificáveis...');
    try {
      // The existing Supabase client is initialized by the original app.js.
      const token = await getAccessToken();
      if (!token) throw Error('Faça login para pesquisar.');
      const response = await fetch('/research', {
        method:'POST',cache:'no-store',credentials:'same-origin',
        headers:{'content-type':'application/json',authorization:'Bearer '+token},
        body:JSON.stringify({question})
      });
      const data = await response.json();
      if (response.ok && data.status === 'complete' && Array.isArray(data.citations) && data.citations.length) {
        pending.textContent = data.answer + '\n\nFontes:\n';
        for (const citation of data.citations.slice(0,5)) {
          if (typeof citation.url !== 'string' || !citation.url.startsWith('https://')) continue;
          const a = document.createElement('a');
          a.href = citation.url;
          a.target = '_blank';
          a.rel = 'noopener noreferrer';
          a.textContent = citation.title || citation.url;
          pending.append(a,document.createTextNode('\n'));
        }
        pending.append(document.createTextNode('\nPesquisa avulsa: não adicionada ao histórico.'));
      } else pending.textContent = data.answer || data.error || 'Não consegui pesquisar agora.';
    } catch { pending.textContent = 'Não consegui pesquisar agora. Tente novamente.'; }
    finally { button.disabled = false; }
  });
})();
