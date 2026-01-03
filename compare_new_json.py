
import json
import re

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\lighthousesbr_new.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def normalize_name(name):
    # Remove prefix "Farol de ", "Farol do ", etc.
    name = name.lower()
    prefixes = ["farol de ", "farol da ", "farol do ", "farol no ", "farol "]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
    # strip spaces
    return name.strip()

def compare():
    try:
        # Load JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            j_data = json.load(f)
            
        # Map JSON by normalized name
        j_map = {}
        for item in j_data:
            n = normalize_name(item.get('name', ''))
            j_map[n] = item

        # Load TXT
        with open(txt_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        txt_map = {}
        header_lines = 1
        for line in lines[header_lines:]:
            parts = line.split('\t')
            if len(parts) > 1:
                n = normalize_name(parts[0])
                txt_map[n] = parts

        print(f"JSON Count: {len(j_map)}")
        print(f"TXT Count: {len(txt_map)}")
        
        # 1. Names in JSON not in TXT
        missing_in_txt = [n for n in j_map if n not in txt_map]
        print(f"\nIn JSON but NOT in TXT ({len(missing_in_txt)}):")
        for n in missing_in_txt[:10]:
            print(f" - {j_map[n]['name']}")
        if len(missing_in_txt) > 10: print(" ...")

        # 2. Names in TXT not in JSON
        missing_in_json = [n for n in txt_map if n not in j_map]
        print(f"\nIn TXT but NOT in JSON ({len(missing_in_json)}):")
        for n in missing_in_json[:10]:
            print(f" - {txt_map[n][0]}")
        if len(missing_in_json) > 10: print(" ...")

        # 3. Content Diff for Matches
        common = [n for n in j_map if n in txt_map]
        print(f"\nCommon entries: {len(common)}")
        
        diffs = 0
        print("\nSample Diffs (TXT vs JSON):")
        for n in common:
            j_item = j_map[n]
            t_parts = txt_map[n]
            
            # Compare Lat
            t_lat = t_parts[1].strip()
            j_lat = j_item.get('lat', '').strip()
            
            # Simple string compare? Or roughly?
            if t_lat != j_lat:
                if diffs < 5:
                    print(f"[{n}] Lat:")
                    print(f"  TXT : {t_lat}")
                    print(f"  JSON: {j_lat}")
                diffs += 1
                
        print(f"Total entries with different Latitude strings: {diffs}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    compare()
