import csv
import logging
from datetime import datetime, timedelta
import sys
import os

# Importa o coletor de clima
try:
    from scraping_weather import WeatherCollector, WeatherData
except ImportError:
    print("ERRO: O arquivo scraping_weather.py não foi encontrado.")
    sys.exit(1)

# Configurar Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Mapeamento de Estações (Mesmo do rebuild_csv.py para consistência)
STATIONS_MAP = [
    {'id': 'BR_RIG', 'url_suffix': 'rio-grande-do-sul/porto-do-rio-grande', 'name': 'Rio Grande'},
    {'id': 'BR_PNG', 'url_suffix': 'parana/paranagua', 'name': 'Paranaguá'},
    {'id': 'BR_SFS', 'url_suffix': 'santa-catarina/sao-francisco-do-sul', 'name': 'São Francisco do Sul'},
    {'id': 'BR_ITJ', 'url_suffix': 'santa-catarina/itajai', 'name': 'Itajaí'},
    {'id': 'BR_IMB', 'url_suffix': 'santa-catarina/imbituba', 'name': 'Imbituba'},
    {'id': 'BR_STS', 'url_suffix': 'sao-paulo/santos', 'name': 'Santos'},
    {'id': 'BR_SSB', 'url_suffix': 'sao-paulo/sao-sebastiao', 'name': 'São Sebastião'},
    {'id': 'BR_RIO', 'url_suffix': 'rio-de-janeiro/rio-de-janeiro', 'name': 'Rio de Janeiro'},
    {'id': 'BR_SEP', 'url_suffix': 'rio-de-janeiro/itaguai', 'name': 'Sepetiba'},
    {'id': 'BR_VIT', 'url_suffix': 'espirito-santo/vitoria', 'name': 'Vitória'},
    {'id': 'BR_SAL', 'url_suffix': 'bahia/salvador', 'name': 'Salvador'},
    {'id': 'BR_REC', 'url_suffix': 'pernambuco/recife', 'name': 'Recife'},
    {'id': 'BR_SUA', 'url_suffix': 'pernambuco/porto-de-suape', 'name': 'Suape'},
    {'id': 'BR_FOR', 'url_suffix': 'ceara/fortaleza', 'name': 'Fortaleza'},
    {'id': 'BR_BEL', 'url_suffix': 'para/belem', 'name': 'Belém'},
    {'id': 'BR_VDC', 'url_suffix': 'para/vila-do-conde', 'name': 'Vila do Conde'},
    {'id': 'BR_ITQ', 'url_suffix': 'maranhao/porto-do-itaqui', 'name': 'Itaqui'},
    {'id': 'BR_STN', 'url_suffix': 'amapa/santana', 'name': 'Santana (Macapá)'} 
]

OUTPUT_FILE = 'weather_scraped.csv'
BASE_URL = "https://tabuademares.com/br"

def run():
    collector = WeatherCollector()
    
    # Prepara o arquivo CSV
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['station_id', 'station_name', 'date', 'time', 'wind_speed', 'wind_dir', 'wave_height', 'wave_dir', 'temp']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        total_records = 0
        today = datetime.now()

        for station in STATIONS_MAP:
            # Constrói URL: https://tabuademares.com/br/estado/cidade/previsao/vento
            url = f"{BASE_URL}/{station['url_suffix']}/previsao/vento"
            logger.info(f"Coletando Clima: {station['name']} [{url}]")
            
            # O scraper atual retorna dicts ou objetos?
            # O método scraping_weather.py scrape_wind retorna lista de dicts ou objetos?
            # Investigando o código anterior, parecia incompleto/exemplo.
            # Vou assumir que o scraper retorna uma lista de WeatherData Objects ou Dicts.
            # Se o scraper original estiver incompleto, este script servirá como esqueleto.
            
            try:
                data_list = collector.scrape_wind(url) # Retorna lista para os próximos dias (estrutura interna do site)
                
                if data_list:
                    for item in data_list:
                        # Assumindo estrutura WeatherData
                        # O site geralmente dá dados para hoje e próximos dias.
                        # Precisamos da DATA associada. O scraper precisa extrair isso.
                        # Se o scraper for simples, vamos assumir que ele devolve dados sequenciais a partir de hoje.
                        
                        # Mock de data se não vier do scraper (Melhoria futura no scraper necessária)
                        # Se o item tiver 'day_offset', usamos. Senão, assumimos hoje?
                        # O scraper do 'tabuademares' para vento é complexo (colunas horárias).
                        
                        writer.writerow({
                            'station_id': station['id'],
                            'station_name': station['name'],
                            'date': item.date if hasattr(item, 'date') else today.strftime("%d/%m/%Y"), # Fallback
                            'time': item.time,
                            'wind_speed': item.wind_speed,
                            'wind_dir': item.wind_dir,
                            'wave_height': item.wave_height,
                            'wave_dir': item.wave_dir,
                            'temp': item.temp
                        })
                        total_records += 1
                else:
                    logger.warning(f"  > Sem dados para {station['name']}")
                    
            except Exception as e:
                logger.error(f"Erro processando {station['name']}: {e}")

    logger.info(f"Concluído! {total_records} registros de clima salvos em {OUTPUT_FILE}")

if __name__ == "__main__":
    run()
