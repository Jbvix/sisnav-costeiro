
import json
import unicodedata

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def normalize(name):
    if not name:
        return ""
    # Normalize unicode characters
    name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII')
    name = name.lower().strip()
    # Remove common prefixes
    prefixes = ["farol de ", "farol da ", "farol do ", "farol "]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
    return name.strip()

def process():
    # Read TXT
    monitor_names = set()
    try:
        with open(txt_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            for line in lines[1:]: # Skip header
                parts = line.split('\t')
                if parts:
                    raw_name = parts[0]
                    norm_name = normalize(raw_name)
                    if norm_name:
                        monitor_names.add(norm_name)
        # Add some manual variations or check partials later? No, strict set match for now.
    except Exception as e:
        print(f"Error reading TXT: {e}")
        return

    # Read JSON
    missing_lighthouses = []
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        elements = data.get('elements', [])
        for el in elements:
            tags = el.get('tags', {})
            name = tags.get('name')
            if name:
                norm_name = normalize(name)
                # Check if it exists in monitor
                if norm_name not in monitor_names:
                    # Try fuzzy?
                    # Maybe the monitor list has "Ponta de Pedras" and JSON has "Pedras"?
                    # Just strictly missing for now.
                    missing_lighthouses.append(name)
            else:
                 # If no name, logic? maybe skip
                 pass

        print(f"Total entries in JSON: {len(elements)}")
        print(f"Entries with name in JSON: {sum(1 for e in elements if 'name' in e.get('tags', {}))}")
        print(f"Entries in MONITOR: {len(monitor_names)}")
        print(f"Missing in MONITOR: {len(missing_lighthouses)}")
        print("\n--- Missing Lighthouses ---")
        for m in sorted(missing_lighthouses):
            print(m)

    except Exception as e:
        print(f"Error reading JSON: {e}")

if __name__ == "__main__":
    process()
