
import json
import math

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

targets = [
    "Farol Atalaia",
    "Farol Cristóvão Pereira",
    "Farol da Ponta Alegre",
    "Farol de Capao da Canoa",
    "Farol de Itapuã",
    "Farol de Tramandaí",
    "Farol do Bojuru"
]

def to_deg_min(val, is_lat):
    abs_val = abs(val)
    degrees = int(abs_val)
    minutes = (abs_val - degrees) * 60
    
    hemi = ""
    if is_lat:
        hemi = "N" if val >= 0 else "S"
    else:
        hemi = "E" if val >= 0 else "W"
        
    return f"{degrees:02d}°{minutes:05.2f}' {hemi}"

def get_char(tags):
    # Mapping OSM seamark to DHN style (Approximate)
    # Fl -> Lp
    # Fl(2) -> Lp (2)
    # Iso -> Iso
    # Oc -> Oc
    
    char = tags.get('seamark:light:character', '')
    group = tags.get('seamark:light:group', '')
    period = tags.get('seamark:light:period', '')
    colour = tags.get('seamark:light:colour', '') # White -> B
    
    # Base
    res = ""
    if char == "Fl": res = "Lp"
    elif char == "Iso": res = "Iso"
    elif char == "Oc": res = "Oc"
    elif char == "LFl": res = "LpL"
    else: res = char # Fallback
    
    # Group
    if group:
        res += f" ({group})"
        
    # Colour
    c_map = {'white': 'B', 'red': 'E', 'green': 'V', 'yellow': 'A'}
    c_code = c_map.get(colour.lower(), '')
    if c_code:
        res += f" {c_code}."
    elif res:
        res += "." # End with dot if we have a characteristic type
        
    if not res:
        return "N/D"
        
    return res

def process():
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        found_data = []
        
        # Create a map for case insensitive lookup
        target_map = {t.lower(): t for t in targets}
        
        for el in data.get('elements', []):
            tags = el.get('tags', {})
            name = tags.get('name', '')
            
            # Simple check
            matched_target = None
            for t_low, t_orig in target_map.items():
                if t_low in name.lower():
                    matched_target = t_orig
                    break
            
            if matched_target:
                # remove from map to avoid duplicates if possible, or just keep
                # We want to add them.
                
                lat = el.get('lat')
                lon = el.get('lon')
                
                if lat is None or lon is None:
                    continue
                    
                lat_str = to_deg_min(float(lat), True)
                lon_str = to_deg_min(float(lon), False)
                char_str = get_char(tags)
                
                # Clean name prefix if matches exactly "Farol de ..." vs existing logic?
                # The user asked to add "Farol Atalaia" etc. 
                # In the file, names are like "Atalaia", "Cristóvão Pereira".
                # Usually we remove "Farol de".
                
                final_name = name
                prefixes = ["Farol de ", "Farol da ", "Farol do ", "Farol "]
                for p in prefixes:
                    if final_name.lower().startswith(p.lower()):
                        final_name = final_name[len(p):]
                        break
                
                # Correct "Capao" to "Capão" if needed? 
                # The JSON name is "Farol Capão da Canoa" (with ~) or "Farol de Capao..."?
                # Let's trust the JSON content but maybe fix encoding if mojibake
                try:
                    final_name = final_name.encode('latin1').decode('utf-8')
                except:
                    pass
                    
                desc = "Importado do OSM"
                
                found_data.append(f"{final_name}\t{lat_str}\t{lon_str}\t{char_str}\t{desc}")

        # Remove duplicates based on name match
        unique_lines = sorted(list(set(found_data)))
        
        if not unique_lines:
            print("No targets found to add.")
            return

        print("Adding the following lines:")
        for line in unique_lines:
            print(line)
            
        with open(txt_path, 'a', encoding='utf-8') as f:
            for line in unique_lines:
                f.write(line + '\n')
                
        print("Done.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process()
