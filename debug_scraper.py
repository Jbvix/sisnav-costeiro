import requests
from bs4 import BeautifulSoup
from datetime import datetime

def debug():
    # URL de teste: Paranaguá
    url = "https://tabuademares.com/br/parana/paranagua"
    print(f"DEBUG: Fetching {url}")
    
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
    
    try:
        res = requests.get(url, headers=headers)
        print(f"DEBUG: Status Code: {res.status_code}")
        
        if res.status_code != 200:
            print("ERROR: Failed to fetch page")
            return

        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 1. Check Title
        h1 = soup.find('h1')
        print(f"DEBUG: H1 Text: {h1.text.strip() if h1 else 'None'}")
        
        # 2. Check Table
        table = soup.find('table')
        if not table:
            print("ERROR: Table not found!")
            print("DEBUG: Dumping first 500 chars of HTML:")
            print(res.text[:500])
            return
            
        print("DEBUG: Table found.")
        
        # 3. Check Date Row
        # Tenta encontrar hoje
        now = datetime.now()
        day_str = str(now.day)
        print(f"DEBUG: Searching for day '{day_str}' in table rows...")
        
        rows = table.find_all('tr')
        print(f"DEBUG: Total Rows found: {len(rows)}")
        
        found = False
        for i, row in enumerate(rows): # Check ALL rows
            cells = row.find_all('td')
            if cells:
                first_cell_text = cells[0].get_text(strip=True)
                print(f"DEBUG: Row {i} First Cell: '{first_cell_text}'")
                if day_str in first_cell_text:
                    print("DEBUG: MATCH FOUND!")
                    found = True
                    
                    # 4. Check Tide Data in matching row
                    tide_text = row.get_text(strip=True)
                    print(f"DEBUG: Full Row Text: {tide_text}")
                    break
        
        if not found:
            print(f"ERROR: No row matched day '{day_str}'")

    except Exception as e:
        print(f"EXCEPTION: {e}")

if __name__ == "__main__":
    debug()
