import csv
import logging
from datetime import datetime, timedelta
import sys
import os

# Importa o módulo de scraping existente
try:
    from scraping_tide import TideDataCollector
except ImportError:
    print("ERRO: O arquivo scraping_tide.py não foi encontrado no diretório atual.")
    sys.exit(1)

# Configurar Logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Mapeamento: Sisnav Station ID -> (Estado, Cidade, NomeCSV)
# NomeCSV será usado para linkar com o frontend
STATIONS_MAP = [
    {'id': 'BR_RIG', 'state': 'rio-grande-do-sul', 'city': 'porto-do-rio-grande', 'csv_name': 'Rio Grande'},
    {'id': 'BR_PNG', 'state': 'parana', 'city': 'paranagua', 'csv_name': 'Paranaguá'},
    {'id': 'BR_SFS', 'state': 'santa-catarina', 'city': 'sao-francisco-do-sul', 'csv_name': 'São Francisco do Sul'},
    {'id': 'BR_ITJ', 'state': 'santa-catarina', 'city': 'itajai', 'csv_name': 'Itajaí'},
    {'id': 'BR_IMB', 'state': 'santa-catarina', 'city': 'imbituba', 'csv_name': 'Imbituba'},
    {'id': 'BR_STS', 'state': 'sao-paulo', 'city': 'santos', 'csv_name': 'Santos'},
    {'id': 'BR_SSB', 'state': 'sao-paulo', 'city': 'sao-sebastiao', 'csv_name': 'São Sebastião'},
    {'id': 'BR_RIO', 'state': 'rio-de-janeiro', 'city': 'rio-de-janeiro', 'csv_name': 'Rio de Janeiro'},
    {'id': 'BR_SEP', 'state': 'rio-de-janeiro', 'city': 'itaguai', 'csv_name': 'Sepetiba'}, 
    {'id': 'BR_VIT', 'state': 'espirito-santo', 'city': 'vitoria', 'csv_name': 'Vitória'},
    {'id': 'BR_SAL', 'state': 'bahia', 'city': 'salvador', 'csv_name': 'Salvador'},
    {'id': 'BR_REC', 'state': 'pernambuco', 'city': 'recife', 'csv_name': 'Recife'},
    {'id': 'BR_SUA', 'state': 'pernambuco', 'city': 'porto-de-suape', 'csv_name': 'Suape'}, 
    {'id': 'BR_FOR', 'state': 'ceara', 'city': 'fortaleza', 'csv_name': 'Fortaleza'},
    {'id': 'BR_BEL', 'state': 'para', 'city': 'belem', 'csv_name': 'Belém'},
    {'id': 'BR_VDC', 'state': 'para', 'city': 'vila-do-conde', 'csv_name': 'Vila do Conde'}, 
    {'id': 'BR_ITQ', 'state': 'maranhao', 'city': 'porto-do-itaqui', 'csv_name': 'Itaqui'}, 
]

OUTPUT_FILE = 'tides_scraped.csv'
DAYS_TO_SCRAPE = 10 # Previsão para 10 dias

def run():
    collector = TideDataCollector()
    
    start_date = datetime.now()
    
    # Preparar CSV Writer
    with open(OUTPUT_FILE, 'w', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['station_id', 'station_name', 'date', 'time', 'height', 'type']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        
        total_records = 0
        
        for station in STATIONS_MAP:
            logger.info(f"Processando Estação: {station['csv_name']} ({station['city']}/{station['state']})...")
            
            for i in range(DAYS_TO_SCRAPE):
                current_date = start_date + timedelta(days=i)
                
                # Coleta
                tide_info = collector.collect_tide_data(
                    state=station['state'], 
                    city=station['city'], 
                    date=current_date
                )
                
                if tide_info:
                    # Escreve linhas
                    for tide in tide_info.tides:
                        writer.writerow({
                            'station_id': station['id'],
                            'station_name': station['csv_name'],
                            'date': tide_info.date, # DD/MM/YYYY do scraper
                            'time': tide.time,
                            'height': tide.height,
                            'type': tide.type
                        })
                        total_records += 1
                else:
                    logger.warning(f"  > Falha ou sem dados para {current_date.strftime('%d/%m')}")
            
    logger.info(f"Concluído! {total_records} registros salvos em {OUTPUT_FILE}")

if __name__ == "__main__":
    run()
