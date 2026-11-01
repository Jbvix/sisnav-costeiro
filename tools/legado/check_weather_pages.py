import requests
from bs4 import BeautifulSoup
import re
import time

URLS = {
    "wind": "https://tabuademares.com/br/parana/paranagua/previsao/vento",
    "waves": "https://tabuademares.com/br/parana/paranagua/previsao/ondas",
    "temp": "https://tabuademares.com/br/parana/paranagua/previsao/temperatura"
}

headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
}

s = requests.Session()
s.headers.update(headers)

for key, url in URLS.items():
    print(f"\nScanning {key.upper()} ({url})...")
    try:
        time.sleep(2) # Avoid rate limiting
        res = s.get(url)
        if res.status_code != 200:
            print(f"FAILED: {res.status_code}")
            continue
            
        soup = BeautifulSoup(res.text, 'html.parser')
        text = soup.get_text()
        
        # Check for keywords
        if key == "wind":
            matches = re.findall(r'\d+\s*km/h', text)
            print(f"Found {len(matches)} wind speed matches: {matches[:5]}")
        elif key == "waves":
            matches = re.findall(r'\d+[.,]\d+\s*m', text)
            print(f"Found {len(matches)} wave height matches: {matches[:5]}")
        elif key == "temp":
            matches = re.findall(r'\d+\s*°C', text)
            print(f"Found {len(matches)} temp matches: {matches[:5]}")
            
        # Check tables
        tables = soup.find_all('table')
        print(f"Tables found: {len(tables)}")
        
        for i, tbl in enumerate(tables):
            print(f"--- Table {i} ---")
            headers = [th.get_text(strip=True) for th in tbl.find_all('th')]
            print(f"Headers: {headers}")
            # Print first row of data
            rows = tbl.find_all('tr')
            if len(rows) > 1:
                cols = [c.get_text(strip=True) for c in rows[1].find_all(['td', 'th'])]
                print(f"Row 1: {cols}")
        
    except Exception as e:
        print(f"ERROR: {e}")
