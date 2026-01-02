
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'

pa_lighthouses = [
    "Banco Coroa Grande",
    "Boco do Furo",
    "Boiucu",
    "Caete",
    "Camaleao",
    "Camapijo",
    "Cascalheira",
    "Colares",
    "Farol de Belém",
    "Ilha Cameleao",
    "Ilha Cotijuba",
    "Ilha Joroca",
    "Ilha Jupatituba",
    "Ilha Jutuba",
    "Ilha Mandi",
    "Ilha Tatuoca",
    "Ilha das Araras",
    "Ilha do Apeu",
    "Ilha do Capim",
    "Ilha do Machadinho",
    "Ilha dos Amores, Salvaterra",
    "Itaguary",
    "Joanes",
    "Machadinho",
    "Pedra da Manteiga",
    "Ponta Marapanim",
    "Ponta Maria Teresa",
    "Ponta do Chapeu Virado",
    "Ponto de Santana",
    "Quatipuru",
    "Rio Arari",
    "Rio Arrozal"
]

def check_pa():
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        print(f"{'Name':<30} | {'Lat':<10} | {'Lon':<10}")
        print("-" * 55)
        
        count = 0
        for el in data.get('elements', []):
            tags = el.get('tags', {})
            name = tags.get('name', '')
            
            # Loose match
            matched = False
            for pa in pa_lighthouses:
                if pa.lower() in name.lower() or name.lower() in pa.lower():
                    matched = True
                    break
            
            if matched:
                lat = el.get('lat')
                lon = el.get('lon')
                print(f"{name[:30]:<30} | {lat:<10} | {lon:<10}")
                count += 1
                
        print(f"\nFound {count} matches.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_pa()
