
import logging
from scraping_weather import WeatherCollector

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def debug_weather():
    collector = WeatherCollector()
    
    # URL that was used in update_weather_batch
    # Base: https://tabuademares.com/br
    # Suffix: pernambuco/suape
    # Final: https://tabuademares.com/br/pernambuco/suape/previsao/vento
    
    url = "https://tabuademares.com/br/pernambuco/suape/previsao/vento"
    print(f"DEBUG: Testing URL: {url}")
    
    try:
        # 1. Test Head/Get first to verify 200 OK
        response = collector.session.get(url)
        print(f"DEBUG: HTTP Status: {response.status_code}")
        
        if response.status_code != 200:
            print("ERROR: URL not reachable.")
            return

        # 2. Test Parsed Result
        data = collector.scrape_wind(url)
        if data:
            print(f"SUCCESS: Found {len(data)} records.")
            for i, d in enumerate(data[:5]):
                print(f"  [{i}] {d}")
        else:
            print("FAILURE: No data returned from scrape_wind.")
            
            # 3. If fail, inspect HTML snippet
            print("DEBUG: Inspecting HTML keys...")
            from bs4 import BeautifulSoup
            soup = BeautifulSoup(response.text, 'html.parser')
            # Look for wind table or specific markers
            table = soup.find('table', id='tabla_viento') # hypothetical ID, or class
            print(f"DEBUG: Table found? {table is not None}")
            
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    debug_weather()
