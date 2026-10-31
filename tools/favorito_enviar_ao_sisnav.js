/**
 * =============================================================================
 * SISNAV COSTEIRO - Favorito "Enviar ao SISNAV" (bookmarklet)
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-10-30 23:36 (UTC-3)   Versão: 1.2 (v3.10.2)
 * HISTÓRICO DE MODIFICAÇÕES
 *  1.2 (v3.10.2, 2026-10-30 23:36) - Aba do resultado aberta NO CLIQUE (antes do
 *      download); antes o bloqueador de pop-ups barrava a aba em silêncio.
 *      Sem permissão de pop-up, envia na própria aba. REFAZER O FAVORITO.
 *  1.1 (v3.10.1, 2026-10-30 23:18) - Envio para https://sisnav.tuglife.live (o
 *      Netlify repassa ao Railway). Antes ia direto a *.up.railway.app, domínio
 *      bloqueado em algumas redes de bordo/empresa. Testado com 698 KB.
 *      QUEM JÁ TEM O FAVORITO PRECISA SUBSTITUIR A URL PELA LINHA NOVA.
 *  1.0 (v3.8.0, 2026-10-30) - Versão inicial.
 * -----------------------------------------------------------------------------
 * USO: abrir https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar
 *      e clicar no favorito. Na 1ª vez pede o token do convite SISNAV.
 *
 * COMO FUNCIONA (e por que assim):
 *  1. O navegador do oficial JÁ passou pelo desafio anti-robô da Marinha,
 *     então ele consegue ler o arquivo avradio_NN.json (mesmo site = permitido).
 *  2. A página da Marinha proíbe fetch() para outros sites (CSP connect-src),
 *     mas PERMITE enviar formulários (form-action https:). Por isso o envio
 *     ao SISNAV é um <form method=POST> aberto numa nova aba com o resultado
 *     (aba aberta no instante do clique - v3.10.2).
 *  3. O token fica guardado só neste navegador (localStorage do site da
 *     Marinha) para não precisar digitar de novo.
 * Analogia: é o mensageiro que já tem o crachá do porto - entra, pega o
 * boletim no quadro de avisos e leva ao passadiço.
 *
 * A versão de UMA LINHA (a que vai no campo URL do favorito) está no fim.
 * =============================================================================
 */
(async () => {
  const API = 'https://sisnav.tuglife.live/api/dhn/avradio-upload';
  const K = 'sisnav_invite_token';
  // v3.10.2: a aba do resultado abre JÁ NO CLIQUE (gesto do usuário). Antes ela
  // abria depois do download do JSON e o bloqueador de pop-ups a barrava em
  // silêncio ("nenhuma aba abriu"). Se ainda assim for bloqueada (w = null),
  // o envio acontece na própria aba (botão Voltar retorna à página da Marinha).
  const w = window.open('', 'sisnav_envio');
  if (w) { try { w.document.write('<p style="font-family:sans-serif;padding:24px">SISNAV: enviando os Avisos-Rádio da DHN…</p>'); } catch (e) { /* ignora */ } }
  try {
    // 1) acha o link do avradio_NN.json de maior número na página
    const html = document.documentElement.innerHTML;
    const achados = [...html.matchAll(/[^"'\s<>]*avradio_(\d+)\.json/g)]
      .sort((a, b) => Number(b[1]) - Number(a[1]));
    if (!achados.length) {
      if (w) w.close();
      alert('SISNAV: abra a página "Avisos-Rádio Náuticos e SAR" da DHN e clique de novo.');
      return;
    }
    const url = new URL(achados[0][0], location.href).href;

    // 2) token do convite (pede só na 1ª vez)
    let token = localStorage.getItem(K);
    if (!token) {
      token = (prompt('SISNAV: cole o TOKEN do seu convite (o código depois de token= no link do convite):') || '').trim();
      if (!token) { if (w) w.close(); return; }
      localStorage.setItem(K, token);
    }

    // 3) lê o JSON oficial (mesmo site, permitido)
    const r = await fetch(url, { cache: 'no-store' });
    const d = await r.json();
    const payload = JSON.stringify({ atualizado: d.atualizado, avisos: d.avisos, fonte: url });

    // 4) envia por formulário (permitido pela CSP) para a aba aberta no clique
    const f = document.createElement('form');
    f.method = 'POST'; f.action = API; f.target = w ? 'sisnav_envio' : '_self';
    for (const [n, v] of [['token', token], ['payload', payload]]) {
      const t = document.createElement('textarea'); t.name = n; t.value = v; f.appendChild(t);
    }
    f.style.display = 'none'; document.body.appendChild(f); f.submit(); f.remove();
  } catch (e) {
    if (w) w.close();
    alert('SISNAV: erro ao enviar - ' + e);
  }
})();

/* ---- VERSÃO EM UMA LINHA (copiar TUDO abaixo para o campo URL do favorito) ----
javascript:(async()=>{const API='https://sisnav.tuglife.live/api/dhn/avradio-upload',K='sisnav_invite_token';const w=window.open('','sisnav_envio');if(w){try{w.document.write('<p style="font-family:sans-serif;padding:24px">SISNAV: enviando os Avisos-Radio da DHN...</p>')}catch(e){}}try{const a=[...document.documentElement.innerHTML.matchAll(/[^"'\s<>]*avradio_(\d+)\.json/g)].sort((x,y)=>Number(y[1])-Number(x[1]));if(!a.length){if(w)w.close();alert('SISNAV: abra a pagina Avisos-Radio Nauticos e SAR da DHN e clique de novo.');return}const u=new URL(a[0][0],location.href).href;let t=localStorage.getItem(K);if(!t){t=(prompt('SISNAV: cole o TOKEN do seu convite (o codigo depois de token= no link):')||'').trim();if(!t){if(w)w.close();return}localStorage.setItem(K,t)}const d=await(await fetch(u,{cache:'no-store'})).json();const p=JSON.stringify({atualizado:d.atualizado,avisos:d.avisos,fonte:u});const f=document.createElement('form');f.method='POST';f.action=API;f.target=w?'sisnav_envio':'_self';for(const[n,v]of[['token',t],['payload',p]]){const x=document.createElement('textarea');x.name=n;x.value=v;f.appendChild(x)}f.style.display='none';document.body.appendChild(f);f.submit();f.remove()}catch(e){if(w)w.close();alert('SISNAV: erro ao enviar - '+e)}})();
---- FIM ---- */
