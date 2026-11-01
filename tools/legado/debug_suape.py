
import logging
from datetime import datetime
from scraping_tide import TideDataCollector
import re

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_suape():
    collector = TideDataCollector()
    
    variants = ["suape"]
    state = "pernambuco"
    date = datetime.now()
    
    for city in variants:
        print(f"DEBUG: Testing {city}")
        data = collector.collect_tide_data(state, city, date)
        if data:
             print(f"SUCCESS: Found {len(data.tides)} tides.")
             for t in data.tides:
                 print(t)
        else:
             print("FAILURE: No data returned.")



if __name__ == "__main__":
    debug_suape()
