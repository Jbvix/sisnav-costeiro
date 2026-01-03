
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'

def inspect_tags():
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        print("Checking sample tags for description fields...")
        count = 0 
        for el in data.get('elements', [])[:100]:
            tags = el.get('tags', {})
            name = tags.get('name', 'Unknown')
            
            # Interesting keys
            keys = ['man_made', 'seamark:landmark:structure', 'seamark:light:height', 'height', 'seamark:landmark:colour', 'colour', 'description']
            
            info = []
            for k in keys:
                if k in tags:
                    info.append(f"{k}={tags[k]}")
            
            if info:
                print(f"{name}: {', '.join(info)}")
                count += 1
                if count > 20: break
                
    except Exception as e:
        print(e)

if __name__ == "__main__":
    inspect_tags()
