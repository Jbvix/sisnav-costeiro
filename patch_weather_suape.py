
import logging
from scraping_weather import WeatherCollector, WeatherData
import csv
import os
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def patch_weather_suape():
    collector = WeatherCollector()
    
    # Station Info
    station_id = 'BR_SUA'
    station_name = 'Suape'
    url = "https://tabuademares.com/br/pernambuco/suape/previsao/vento"
    
    output_file = 'weather_scraped.csv'
    
    logger.info(f"Patching Suape weather to {output_file}...")
    
    try:
        data_list = collector.scrape_wind(url)
        
        if data_list and len(data_list) > 0:
            logger.info(f"Scraped {len(data_list)} weather records.")
            
            with open(output_file, 'a', newline='', encoding='utf-8') as csvfile:
                fieldnames = ['station_id', 'station_name', 'date', 'time', 'wind_speed', 'wind_dir', 'wave_height', 'wave_dir', 'temp']
                writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
                
                # Check file size to determine if header needed (unlikely for patch)
                if os.stat(output_file).st_size == 0:
                    writer.writeheader()
                
                count = 0
                for item in data_list:
                    # Ensure date is present
                    date_val = item.date if hasattr(item, 'date') and item.date else datetime.now().strftime("%d/%m/%Y")
                    
                    writer.writerow({
                        'station_id': station_id,
                        'station_name': station_name,
                        'date': date_val,
                        'time': item.time,
                        'wind_speed': item.wind_speed,
                        'wind_dir': item.wind_dir,
                        'wave_height': item.wave_height,
                        'wave_dir': item.wave_dir,
                        'temp': item.temp
                    })
                    count += 1
                
                logger.info(f"Successfully appended {count} records to CSV.")
        else:
            logger.error("No data returned from scraper.")
            
    except Exception as e:
        logger.error(f"Patch failed: {e}")

if __name__ == "__main__":
    patch_weather_suape()
