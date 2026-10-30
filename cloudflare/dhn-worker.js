/**
 * =============================================================================
 * SISNAV COSTEIRO - cloudflare/dhn-worker.js (Cloudflare Worker "sisnav-dhn")
 * Autor: Jossian Brito (Charlie Bravo) | TugLife Systems | Assistido por Claude
 * Data/Hora: 2026-10-30 (UTC-3)   Versão: 1.0 (Etapa A - plano 1)
 * -----------------------------------------------------------------------------
 * POR QUE EXISTE
 *   O firewall do site da Marinha recusa (403) os avisos-rádio quando o pedido
 *   sai do Railway (datacenter nos EUA). Este Worker roda na rede da Cloudflare
 *   (com pontos de presença no Brasil) e busca o JSON oficial da DHN no lugar
 *   do Railway. Analogia: é o rebocador que encosta no cais onde o navio
 *   grande não consegue atracar, e traz a carga até ele.
 *
 * ROTAS
 *   GET /test     -> diagnóstico SEM dados: só os códigos HTTP da página e do
 *                    JSON (200 = passou; 403 = firewall recusou). Aberto.
 *   GET /avradio  -> o JSON da DHN ({"atualizado","avisos":[...]}) mais o
 *                    campo "fonte" com o endereço lido. Exige o cabeçalho
 *                    X-Worker-Key igual ao segredo WORKER_KEY (evita que
 *                    terceiros usem o Worker como proxy).
 *
 * SEGREDO
 *   WORKER_KEY: definido no painel do Worker (Settings > Variables and
 *   Secrets, tipo "Secret"). O mesmo valor vai no Railway como DHN_WORKER_KEY.
 * =============================================================================
 */
const PAGE = "https://www.marinha.mil.br/chm/dados-do-segnav-aviso-radio-nautico-tela/avisos-radio-nauticos-e-sar";
const HOME = "https://www.marinha.mil.br/chm/";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Referer": HOME,
};

/** Lê a página e devolve o endereço do avradio_NN.json de maior número. */
async function findJsonUrl() {
  const r = await fetch(PAGE, { headers: HEADERS });
  const html = r.ok ? await r.text() : "";
  const found = [...html.matchAll(/["']([^"']*avradio_(\d+)\.json)["']/gi)];
  if (!found.length) return { status: r.status, url: null };
  found.sort((a, b) => Number(b[2]) - Number(a[2]));      // maior número = mais recente
  return { status: r.status, url: new URL(found[0][1], PAGE).toString() };
}

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;

    if (path === "/test") {
      const page = await findJsonUrl();
      let jsonStatus = null;
      if (page.url) {
        const r = await fetch(page.url, { headers: { ...HEADERS, Referer: PAGE } });
        jsonStatus = r.status;
      }
      return json({ pagina: page.status, json: jsonStatus, arquivo: page.url ? page.url.split("/").pop() : null });
    }

    if (path === "/avradio") {
      if (!env.WORKER_KEY || request.headers.get("X-Worker-Key") !== env.WORKER_KEY) {
        return json({ error: "nao autorizado" }, 401);
      }
      const page = await findJsonUrl();
      if (!page.url) return json({ error: "pagina DHN sem JSON", pagina: page.status }, 502);
      const r = await fetch(page.url, { headers: { ...HEADERS, Referer: PAGE } });
      if (!r.ok) return json({ error: "DHN recusou o JSON", status: r.status }, 502);
      const data = await r.json();
      data.fonte = page.url;
      return json(data);
    }

    return json({ servico: "sisnav-dhn", rotas: ["/test", "/avradio"] });
  },
};
