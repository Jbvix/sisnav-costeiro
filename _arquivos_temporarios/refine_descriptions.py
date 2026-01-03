
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def fix_mojibake(text):
    try:
        return text.encode('latin1').decode('utf-8')
    except:
        return text

def normalize(name):
    if not name: return ""
    name = fix_mojibake(name)
    name = name.lower()
    prefixes = ["farol de ", "farol da ", "farol do ", "farol "]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
    # normalize chars
    return name.lower().replace('ã', 'a').replace('ç', 'c').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u').strip()

def get_desc(tags):
    # Try to construct a decent description
    desc = tags.get('description', '')
    
    parts = []
    
    structure = tags.get('seamark:landmark:structure')
    man_made = tags.get('man_made')
    colour = tags.get('seamark:landmark:colour') or tags.get('seamark:light:colour')
    height = tags.get('seamark:light:height') or tags.get('height')
    
    # Translation map
    s_map = {'tower': 'Torre', 'beacon': 'Baliza', 'lighthouse': 'Farol', 'mast': 'Mastro', 'column': 'Coluna', 'metal': 'metálica', 'concrete': 'de concreto'}
    c_map = {'white': 'branca', 'red': 'vermelha', 'black': 'preta', 'green': 'verde', 'yellow': 'amarela'}
    
    base = ""
    if structure:
        base = s_map.get(structure.lower(), structure.capitalize())
    elif man_made == 'lighthouse':
        base = "Farol"
    elif man_made == 'tower':
        base = "Torre"
        
    if colour:
        c_pt = c_map.get(colour.lower(), colour)
        base += f" {c_pt}"
        
    if base:
        parts.append(base)
        
    if height:
        try:
            h_val = float(height)
            parts.append(f"Altura {int(h_val)}m")
        except:
            parts.append(f"Altura {height}")
            
    # Use existing description if available and not redundant?
    # Usually OSM description is English, e.g. "White truncated..."
    # Keep our constructed one generally.
    
    if not parts:
        return ""
        
    return ", ".join(parts)

def process():
    try:
        # Load JSON into map
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        json_map = {}
        for el in data.get('elements', []):
            tags = el.get('tags', {})
            name = tags.get('name')
            if name:
                norm = normalize(name)
                json_map[norm] = tags
                
                # Also index "Farol Name" variations? 
                # Normalize already strips Farol
                pass
        
        # Process TXT
        with open(txt_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        updated_count = 0
        
        for line in lines:
            parts = line.split('\t')
            if len(parts) > 4:
                desc = parts[4].strip()
                if "Importado do OSM" in desc or desc == "N/D":
                    # Needs update
                    name = parts[0]
                    norm = normalize(name)
                    
                    # Try to find in JSON map
                    tags = json_map.get(norm)
                    # Try partial match manually if not exact?
                    if not tags:
                        # Scan checks? Expensive but okay for 400 items
                        for k, v in json_map.items():
                            if k in norm or norm in k:
                                tags = v
                                break
                    
                    new_desc = ""
                    if tags:
                        new_desc = get_desc(tags)
                    
                    if new_desc:
                        parts[4] = new_desc
                        updated_count += 1
                    else:
                        parts[4] = "" # Clear "Importado do OSM"
                        
                    line = '\t'.join(parts)
                    if not line.endswith('\n'): line += '\n'
            
            new_lines.append(line)
            
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        print(f"Updated {updated_count} descriptions.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process()
