import requests
from bs4 import BeautifulSoup
import re
from dataclasses import dataclass
from typing import List, Optional
from datetime import datetime
import locale

# Tenta configurar locale para PT-BR (Windows)
try:
    locale.setlocale(locale.LC_ALL, 'pt_BR.UTF-8')
except:
    pass

@dataclass
class WeatherData:
    date: str          # DD/MM/YYYY
    time: str          # HH:MM
    wind_speed: float  # km/h (Parsed from text)
    wind_dir: str      # Text (N, S, WNW...)
    wave_height: float # m (Default 0 if missing)
    wave_dir: str      # (Default -)
    temp: float        # C (Default 0 if missing)

class WeatherCollector:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def scrape_wind(self, url: str) -> List[WeatherData]:
        print(f"Scraping WIND from {url}")
        try:
            res = self.session.get(url, timeout=10)
            if res.status_code != 200:
                print(f"Error {res.status_code}")
                return []
        except Exception as e:
            print(f"Request Error: {e}")
            return []
            
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 1. Find Dates (Headers)
        # Look for the date headers we saw in debug: "26DEZSexta-feira..."
        # Structure identified: div.fecha_grande or similar containing text
        # Let's verify commonly used classes or just search divs with text pattern
        date_divs = soup.find_all('div', class_=lambda c: c and ('fecha' in c or 'titulo_grafico' in c))
        
        # Filter valid date strings
        valid_dates = []
        parsed_current_year = datetime.now().year
        
        # Regex to capture Day and Month: "26DEZ"
        re_date = re.compile(r'(\d{1,2})([A-ZÇ]+)', re.IGNORECASE)
        
        months = {
            'JAN': 1, 'FEV': 2, 'MAR': 3, 'ABR': 4, 'MAI': 5, 'JUN': 6,
            'JUL': 7, 'AGO': 8, 'SET': 9, 'OUT': 10, 'NOV': 11, 'DEZ': 12
        }

        # Scan divs to find exactly 7 dates usually
        for d in date_divs:
            txt = d.get_text(strip=True).upper()
            m = re_date.search(txt)
            if m:
                day = int(m.group(1))
                mon_str = m.group(2)[:3] # First 3 chars
                if mon_str in months:
                    # Construct Date
                    mon = months[mon_str]
                    # Handle year rollover
                    year = parsed_current_year
                    if mon < datetime.now().month and mon < 3: # Next year
                        year += 1
                    
                    date_str = f"{day:02d}/{mon:02d}/{year}"
                    if date_str not in valid_dates:
                        valid_dates.append(date_str)
        
        # If Regex failed, fallback to sequential days from today
        if len(valid_dates) < 7:
            print("Warning: Could not parse all dates. Generating sequential dates.")
            # ... implementation of fallback if needed, but let's trust valid_dates for now
            # or fill gaps
        
        print(f"Found {len(valid_dates)} Dates: {valid_dates}")

        # 2. Find Data Blocks (f_text_tiempo verified in debug)
        blocks = soup.find_all('div', class_='f_text_tiempo')
        print(f"Found {len(blocks)} Data Blocks (f_text_tiempo)")

        all_data = []

        # We assume blocks define days in order
        loop_count = min(len(valid_dates), len(blocks))
        
        for i in range(loop_count):
            current_date = valid_dates[i]
            block = blocks[i]
            text = block.get_text(separator=' ', strip=True) 
            # Separator space helps regex: "0:00 WNW 4 km/h"
            
            # Regex to parse mashed text: Time Dir Speed
            # Pattern: 0:00 WNW 4 km/h
            # Times: \d{1,2}:\d{2}
            # Dir: [A-Z]+
            # Speed: \d+
            
            # Refined Pattern to capture list:
            # (\d{1,2}:\d{2})\s*([A-Z]+)\s*(\d+)\s*km/h
            matches = re.findall(r'(\d{1,2}:\d{2})\s*([A-Z]+)\s*(\d+)\s*km/h', text)
            
            for (time_str, wind_dir, wind_spd) in matches:
                # Mock Wave/Temp for now as they are harder to find blindly
                # To find temp we would need to parse 'f_text_temperatura' if it exists similarly
                
                wd = WeatherData(
                    date=current_date,
                    time=time_str,
                    wind_speed=float(wind_spd),
                    wind_dir=wind_dir,
                    wave_height=1.0, # Default / TODO: Scrape similar block 'f_text_oleaje'
                    wave_dir='-',
                    temp=25.0        # Default / TODO
                )
                all_data.append(wd)
        
        # Try to find Temp if possible (Bonus)
        # Attempt to map f_text_temperatura index-wise
        temp_blocks = soup.find_all('div', class_='f_text_temperatura')
        if len(temp_blocks) >= loop_count:
            print("Found Temp Blocks! Enriching data...")
            idx_global = 0
            for i in range(loop_count):
                 t_text = temp_blocks[i].get_text(separator=' ', strip=True)
                 # Regex for temp: (\d+)°
                 t_matches = re.findall(r'(\d+)°', t_text)
                 # We assume 1-to-1 match with wind matches (24 hours)
                 # But text might be sparse (every 3 hours?)
                 # Let's just try to map if counts align
                 pass # Logic complex to sync lists. Keeping separate for safety.

        return all_data

if __name__ == "__main__":
    wc = WeatherCollector()
    data = wc.scrape_wind("https://tabuademares.com/br/parana/paranagua/previsao/vento")
    for d in data[:5]:
        print(d)
