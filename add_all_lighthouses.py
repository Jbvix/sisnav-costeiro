
import json
import os

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'
report_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\missing_lighthouses_grouped.txt'

def to_deg_min(val, is_lat):
    abs_val = abs(val)
    degrees = int(abs_val)
    minutes = (abs_val - degrees) * 60
    hemi = "N" if is_lat and val >= 0 else "S" if is_lat else "E" if val >= 0 else "W"
    return f"{degrees:02d}°{minutes:05.2f}' {hemi}"

def get_char(tags):
    char = tags.get('seamark:light:character', '')
    group = tags.get('seamark:light:group', '')
    colour = tags.get('seamark:light:colour', '')
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

def normalize(name):
    if not name: return ""
    name = fix_mojibake(name)
    name = name.lower()
    prefixes = ["farol de ", "farol da ", "farol do ", "farol "]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
    return name.strip()

def process():
    # 1. Identify PA list from the report
    pa_targets = set()
    try:
        with open(report_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            in_pa = False
            for line in lines:
                line = line.strip()
                if line.startswith("## PA"):
                    in_pa = True
                    continue
                elif line.startswith("##"):
                    in_pa = False
                
                if in_pa and line.startswith("- "):
                    name = line[2:].strip()
                    pa_targets.add(name.lower()) # Store lowercase for loose matching
    except Exception as e:
        print(f"Error reading report: {e}")
        return

    print(f"Identified {len(pa_targets)} lighthouses in Pará group.")

    # 2. Read current MONITOR to avoid duplicates
    existing_monitor = set()
    try:
        with open(txt_path, 'r', encoding='utf-8') as f:
           for line in f.readlines()[1:]:
               parts = line.split('\t')
               if parts:
                   existing_monitor.add(normalize(parts[0]))
    except Exception as e:
        print(f"Error reading TXT: {e}")
        return

    # 3. Process JSON
    new_entries = []
    
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)

        for el in data.get('elements', []):
            tags = el.get('tags', {})
            name = tags.get('name', '')
            if not name: continue
            
            fixed_name = fix_mojibake(name)
            norm_name = normalize(fixed_name)
            
            # Check if it ALREADY exists
            if norm_name in existing_monitor:
                continue
                
            lat = el.get('lat')
            lon = el.get('lon')
            if lat is None or lon is None: continue
            
            lat = float(lat)
            lon = float(lon)
            
            # PA Special Logic
            is_pa = False
            for p in pa_targets:
                if p in fixed_name.lower(): # Loose match "Boco do Furo" in "Farol do Boco do Furo"
                    is_pa = True
                    break
            
            if is_pa:
                if lat > 0:
                    print(f"Correcting PA lighthouse {fixed_name}: Lat {lat} -> {-lat}")
                    lat = -lat
            
            # Generate Line
            clean_name = fixed_name
            prefixes = ["Farol de ", "Farol da ", "Farol do ", "Farol "]
            for p in prefixes:
                if clean_name.lower().startswith(p.lower()):
                    clean_name = clean_name[len(p):]
                    break
            
            lat_str = to_deg_min(lat, True)
            lon_str = to_deg_min(lon, False)
            char_str = get_char(tags)
            desc = "Importado do OSM"
            
            line = f"{clean_name}\t{lat_str}\t{lon_str}\t{char_str}\t{desc}"
            new_entries.append(line)
            
            # Add to set so we don't add duplicates from JSON if JSON has dupes
            existing_monitor.add(norm_name) 

        # Write
        new_entries = sorted(list(set(new_entries)))
        if new_entries:
            print(f"Appending {len(new_entries)} new lighthouses.")
            with open(txt_path, 'a', encoding='utf-8') as f:
                for entry in new_entries:
                    f.write(entry + '\n')
            print("Done.")
        else:
            print("No new entries found to add.")

    except Exception as e:
        print(f"Error processing: {e}")

if __name__ == "__main__":
    process()
