import requests
from bs4 import BeautifulSoup
import collections

urls = [
    "https://tabuademares.com/br/parana/paranagua/previsao/ondas"
]
headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7'
}

for url in urls:
    print(f"\n--- Checking: {url} ---")
    try:
        res = requests.get(url, headers=headers, timeout=10)
        # soup = BeautifulSoup(res.text, 'html.parser')

        # Print raw text of potential wave classes
        # Based on previous pattern f_text_tiempo, maybe f_text_oleaje?
        # Or search for "m" (meters)
        
        soup = BeautifulSoup(res.text, 'html.parser')
        
        # Check f_text_oleaje (if it exists)
        oleaje = soup.find_all(class_='f_text_oleaje')
        if oleaje:
            print(f"Found {len(oleaje)} 'f_text_oleaje'. First 3:")
            for o in oleaje[:3]:
                print(f" -> '{o.get_text(separator=' ', strip=True)}'")
        else:
             print("No 'f_text_oleaje' found.")
             
        # Check text matching ' m' (meters)
        meters = soup.find_all(string=lambda t: t and ' m' in t) # space m
        print(f"Found {len(meters)} strings with ' m'. First 5:")
        for m in meters[:5]:
             print(f" -> '{m.strip()}' (Parent {m.parent.name} class={m.parent.get('class')})")

    except Exception as e:
        print(f"Error: {e}")




