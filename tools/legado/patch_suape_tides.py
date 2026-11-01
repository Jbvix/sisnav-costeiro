
import logging
from datetime import datetime, timedelta
from scraping_tide import TideDataCollector
import csv
import os

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def patch_suape():
    collector = TideDataCollector()
    
    state = "pernambuco"
    city = "suape"
    station_id = "BR_SUA"
    station_name = "Suape"
    
    start_date = datetime.now()
    days_to_scrape = 10
    
    output_file = 'tides_scraped.csv'
    
    logger.info(f"Patching Suape tides to {output_file}...")
    
    with open(output_file, 'a', newline='', encoding='utf-8') as csvfile:
        fieldnames = ['station_id', 'station_name', 'date', 'time', 'height', 'type']
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        
        # Don't write header, just append
        
        total_records = 0
        
        for i in range(days_to_scrape):
            current_date = start_date + timedelta(days=i)
            logger.info(f"Scraping Suape for {current_date.strftime('%d/%m/%Y')}...")
            
            # create new collector per request to avoid session issues? 
            # actually reusing collector worked in debug single run, let's try reuse first.
            # If it fails, I'll move collector init inside loop.
            
            data = collector.collect_tide_data(state, city, current_date)
            
            if data:
                 for tide in data.tides:
                    writer.writerow({
                        'station_id': station_id,
                        'station_name': station_name,
                        'date': data.date,
                        'time': tide.time,
                        'height': tide.height,
                        'type': tide.type
                    })
                    total_records += 1
                 logger.info(f"  > Added {len(data.tides)} tides.")
            else:
                 logger.warning(f"  > No data for {current_date.strftime('%d/%m/%Y')}")

    logger.info(f"Patch complete. Added {total_records} records.")

if __name__ == "__main__":
    patch_suape()
