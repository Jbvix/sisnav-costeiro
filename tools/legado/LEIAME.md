# tools/legado — scripts de depuração e de uso único (fora de produção)

Autor: Jossian Brito (Charlie Bravo) · TugLife Systems · criado em 2026-11-01 11:13 (UTC-3), v3.10.3

Estes 21 arquivos ficavam na raiz do projeto. Foram usados para diagnosticar ou corrigir dados (marés de Suape, faróis, rotas, páginas do CHM) e **não são carregados pelo site nem pelo servidor**. Foram movidos para cá, e não apagados, para preservar o histórico e permitir reuso.

- **Não rodam em produção:** o build do Netlify (`scripts/build_netlify.sh`) não publica `tools/`, e o servidor bloqueia o acesso a esta pasta.
- Alguns importam módulos da raiz (`scraping_tide`, `scraping_weather`). Para usar um deles, rode a partir da raiz do projeto:
  `python -m tools.legado.debug_suape` (ou copie o script de volta temporariamente).
