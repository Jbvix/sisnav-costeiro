
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
    # Gendered handling
    s_map = {'tower': ('Torre', 'f'), 'beacon': ('Baliza', 'f'), 'lighthouse': ('Farol', 'm'), 'mast': ('Mastro', 'm'), 'column': ('Coluna', 'f')}
    
    base = ""
    gender = 'm'
    
    if structure and structure.lower() in s_map:
        base, gender = s_map[structure.lower()]
    elif man_made == 'lighthouse':
        base, gender = 'Farol', 'm'
    elif man_made == 'tower':
        base, gender = 'Torre', 'f'
        
    c_pt = ""
    if colour:
        c_low = colour.lower()
        if c_low == 'white': c_pt = 'branca' if gender == 'f' else 'branco'
        elif c_low == 'red': c_pt = 'vermelha' if gender == 'f' else 'vermelho'
        elif c_low == 'black': c_pt = 'preta' if gender == 'f' else 'preto'
        elif c_low == 'green': c_pt = 'verde'
        elif c_low == 'yellow': c_pt = 'amarela' if gender == 'f' else 'amarelo'
        else: c_pt = c_low # Fallback
        
    if base:
        if c_pt:
            base += f" {c_pt}"
        parts.append(base)
        
    if height:
        try:
            h_val = float(height)
            parts.append(f"Altura {int(h_val)}m")
        except:
            parts.append(f"Altura {height}")
            
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
        
        # Process TXT
        # We need to re-run specific grammar fix on ALL "Farol *" or "Torre *" entries that look like they came from us
        # Or just re-generate descriptions for everything we generated before?
        # We constructed "Importado do OSM" entries.
        # But we ALREADY overwrote them.
        # So we need to detect descriptions that look like "Farol branca" and fix them defined by existing content?
        # Better: Re-run generation logic for ALL items that matched JSON (essentially re-doing the previous step but with better logic)
        
        with open(txt_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        updated_count = 0
        
        for line in lines:
            parts = line.split('\t')
            if len(parts) > 4:
                desc = parts[4].strip()
                name = parts[0]
                norm = normalize(name)
                
                # Check if we should update this description
                # Only if it looks like one we generated OR "Importado do OSM" (if any left)
                # Patterns: "Farol branca", "Torre vermelho", "Altura Xm"
                # If "Altura" in desc OR "Farol" in desc: probably us or safe to overwrite if match found?
                # User asked to clean up imported text.
                # Let's check JSON match. If strict match found, regenerate description.
                
                tags = json_map.get(norm)
                if not tags:
                     # Loose match
                     for k, v in json_map.items():
                        if k in norm or norm in k:
                            tags = v
                            break
                            
                if tags:
                    new_desc = get_desc(tags)
                    if new_desc and new_desc != desc:
                        # Only update if it Changes something (e.g. fixes grammar)
                        # Avoid overwriting custom USER descriptions if they exist and differ significantly?
                        # But user asked to "remove imported text and add characteristics". 
                        # We already did that. Now we fix grammar.
                        parts[4] = new_desc
                        updated_count += 1
                        
                line = '\t'.join(parts)
                if not line.endswith('\n'): line += '\n'
            
            new_lines.append(line)
            
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        print(f"Updated {updated_count} descriptions with grammar fix.")
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process()
