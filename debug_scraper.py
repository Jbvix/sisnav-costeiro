import requests
from bs4 import BeautifulSoup

def debug():
    url = "https://tabuademares.com/br/parana/paranagua/previsao/vento"
    print(f"DEBUG: Fetching {url}")
    
    headers = {'User-Agent': 'Mozilla/5.0'}
    res = requests.get(url, headers=headers)
    soup = BeautifulSoup(res.text, 'html.parser')
    
    # Locate first speed div
    speed = soup.find('div', class_='graf_color_velocidad')
    if speed:
        print("Found first speed div.")
        # Check Parent's siblings or children
        parent = speed.parent
        print(f"Parent Class: {parent.get('class')}")
        
        # Determine container of the "Hour Column"
        # Ascend one more?
        grandparent = parent.parent
        if grandparent:
             print(f"Grandparent Tag: {grandparent.name} Class: {grandparent.get('class')}")
             # Print all text in grandparent to see if WNW etc is there
             print(f"Grandparent Text: {grandparent.get_text(separator='|', strip=True)}")
             
             # Identify Direction Div specifically
             # Usually direction is an IMG or Text?
             # Let's inspect children classes
             for child in grandparent.find_all('div', recursive=False):
                  print(f"  Child Div Class: {child.get('class')} Text: {child.get_text(strip=True)}")

if __name__ == "__main__":
    debug()
