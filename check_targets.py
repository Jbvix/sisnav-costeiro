
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'

targets = [
    "Farol Atalaia",
    "Farol Cristóvão Pereira",
    "Farol da Ponta Alegre",
    "Farol de Capao da Canoa",
    "Farol de Itapuã",
    "Farol de Tramandaí",
    "Farol do Bojuru"
]

try:
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    found_count = 0
    for el in data.get('elements', []):
        tags = el.get('tags', {})
        name = tags.get('name')
        
        # Simple loose match check
        if name and any(t.lower() in name.lower() or name.lower() in t.lower() for t in targets):
            print(f"\n--- {name} ---")
            print(f"Lat: {el.get('lat')}, Lon: {el.get('lon')}")
            # Print interesting tags
            keys_to_show = ['seamark:light:character', 'seamark:light:period', 'seamark:light:range', 'seamark:light:height', 'description', 'man_made']
            for k, v in tags.items():
                if k.startswith('seamark') or k in keys_to_show:
                    print(f"{k}: {v}")
            found_count += 1

    print(f"\nFound {found_count} potential matches.")

except Exception as e:
    print(f"Error: {e}")
