import requests
from bs4 import BeautifulSoup
import re
from dataclasses import dataclass
from typing import List, Optional
import time

@dataclass
class WeatherData:
    time: str
    wind_speed: float  # km/h
    wind_dir: str
    wave_height: float # m
    wave_dir: str
    temp: float        # C

class WeatherCollector:
    def __init__(self):
        self.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
        }
        self.session = requests.Session()
        self.session.headers.update(self.headers)

    def scrape_wind(self, url: str):
        print(f"Scraping WIND from {url}")
        res = self.session.get(url)
        if res.status_code != 200:
            print(f"Error {res.status_code}")
            return []
            
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # The structure seems to be columns for each hour/interval
        # Based on debug: div.f_text_tiempo seems to be a container
        # Let's try to find all 'f_text_tiempo' which might be the columns
        
        cols = soup.find_all('div', class_='f_text_tiempo')
        print(f"Found {len(cols)} time columns")
        
        data = []
        for col in cols:
            # Time is likely in a header or first div
            # Wind speed is in .graf_color_velocidad
            
            # Extract Time
            time_div = col.find('div', class_='f_hora_texto') # Guessing class name, need to verify
            # actually debug output showed:
            # Level 3: <div class='['f_temp_horas']' id='None'>
            # Level 4: <div class='['f_text_tiempo']' id='None'>
            # Level 5: <div class='['f_cont']' id='None'>
            
            # Let's just find the speed div inside this column
            speed_div = col.find('div', class_='graf_color_velocidad')
            if speed_div:
                speed_text = speed_div.get_text(strip=True) # "13 km/h"
                print(f"  Speed Text: {speed_text}")
                
        return data

if __name__ == "__main__":
    wc = WeatherCollector()
    wc.scrape_wind("https://tabuademares.com/br/parana/paranagua/previsao/vento")
