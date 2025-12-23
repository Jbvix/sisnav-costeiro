/**
 * ARQUIVO: GPXParser.js
 * MÓDULO: Utilitário de Leitura de Arquivos GPX
 * AUTOR: Jossian Brito
 * DATA: 2025-12-16
 * VERSÃO: 3.1.0 (Debug Mode)
 */

const GPXParser = {

    /**
     * Analisa o conteúdo XML e extrai os pontos.
     */
    parse: function(xmlString) {
        console.log("GPXParser: Iniciando leitura do arquivo...");
        
        if (!xmlString) {
            throw new Error("O conteúdo do arquivo está vazio.");
        }

        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        
        // Verifica erros de parsing nativos
        const parseError = xmlDoc.getElementsByTagName("parsererror");
        if (parseError.length > 0) {
            console.error("GPXParser: Erro no XML:", parseError[0].textContent);
            throw new Error("O arquivo GPX está corrompido ou não é um XML válido.");
        }

        let points = [];
        
        // Tenta buscar por Rotas (<rtept>)
        let xmlPoints = xmlDoc.getElementsByTagName("rtept");
        console.log(`GPXParser: Encontrados ${xmlPoints.length} pontos de rota (<rtept>).`);
        
        // Se não achar rota, busca por Trilhas (<trkpt>)
        if (xmlPoints.length === 0) {
            xmlPoints = xmlDoc.getElementsByTagName("trkpt");
            console.log(`GPXParser: Encontrados ${xmlPoints.length} pontos de trilha (<trkpt>).`);
        }

        if (xmlPoints.length === 0) {
            throw new Error("Nenhum ponto de navegação encontrado (procurei por rtept e trkpt).");
        }

        // Iteração
        for (let i = 0; i < xmlPoints.length; i++) {
            const pt = xmlPoints[i];
            
            const latStr = pt.getAttribute("lat");
            const lonStr = pt.getAttribute("lon");

            if (!latStr || !lonStr) {
                console.warn(`GPXParser: Ponto ${i+1} ignorado (sem lat/lon).`);
                continue;
            }

            // Extração do Nome
            let name = `WP ${i + 1}`;
            const nameTag = pt.getElementsByTagName("name");
            if (nameTag.length > 0) {
                name = nameTag[0].textContent;
            }

            points.push({
                name: name,
                lat: parseFloat(latStr),
                lon: parseFloat(lonStr)
            });
        }

        console.log(`GPXParser: Total de ${points.length} waypoints processados com sucesso.`);
        return points;
    }
};

export default GPXParser;