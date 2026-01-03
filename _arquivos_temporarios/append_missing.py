
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

targets = [
    "Cristóvão Pereira",
    "Tramandaí"
]

def to_deg_min(val, is_lat):
    abs_val = abs(val)
    degrees = int(abs_val)
    minutes = (abs_val - degrees) * 60
    hemi = "N" if is_lat and val >= 0 else "S" if is_lat else "E" if val >= 0 else "W"
    return f"{degrees:02d}°{minutes:05.2f}' {hemi}"

def get_char(tags):
    char = tags.get('seamark:light:character', '')
    group = tags.get('seamark:light:group', '')
    colour = tags.get('seamark:light:colour', '') # White -> B
    
    res = ""
    if char == "Fl": res = "Lp"
    elif char == "Iso": res = "Iso"
    elif char == "Oc": res = "Oc"
    elif char == "LFl": res = "LpL"
    else: res = char
    
    if group: res += f" ({group})"
    c_map = {'white': 'B', 'red': 'E', 'green': 'V', 'yellow': 'A'}
    if colour.lower() in c_map: res += f" {c_map[colour.lower()]}."
    elif res: res += "."
        
    return res if res else "N/D"

def fix_mojibake(text):
    try:
        return text.encode('latin1').decode('utf-8')
    except:
        return text

def process():
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        found_data = []
        
        for el in data.get('elements', []):
            tags = el.get('tags', {})
            name = tags.get('name', '')
            
            # fix mojibake for matching
            fixed_name = fix_mojibake(name)
            
            matched_target = None
            for t in targets:
                if t.lower() in fixed_name.lower():
                    matched_target = t
                    break
            
            if matched_target:
                lat = el.get('lat')
                lon = el.get('lon')
                
                if lat is None or lon is None: continue
                    
                lat_str = to_deg_min(float(lat), True)
                lon_str = to_deg_min(float(lon), False)
                char_str = get_char(tags)
                
                final_name = fixed_name
                prefixes = ["Farol de ", "Farol da ", "Farol do ", "Farol "]
                for p in prefixes:
                    if final_name.lower().startswith(p.lower()):
                        final_name = final_name[len(p):]
                        break
                        
                desc = "Importado do OSM"
                found_data.append(f"{final_name}\t{lat_str}\t{lon_str}\t{char_str}\t{desc}")

        unique_lines = sorted(list(set(found_data)))
        
        if unique_lines:
            print("Adding:")
            with open(txt_path, 'a', encoding='utf-8') as f:
                for line in unique_lines:
                    print(line)
                    f.write(line + '\n')
        else:
            print("No new targets found.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process()
