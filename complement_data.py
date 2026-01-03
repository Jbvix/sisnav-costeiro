
import json
import re

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\lighthousesbr_new.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def normalize_name(name):
    name = name.lower()
    prefixes = ["farol de ", "farol da ", "farol do ", "farol no ", "farol "]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
    return name.strip()

def process():
    try:
        # Load JSON
        with open(json_path, 'r', encoding='utf-8') as f:
            j_data = json.load(f)
        
        j_map = {}
        for item in j_data:
            n = normalize_name(item.get('name', ''))
            j_map[n] = item
            
        # Load TXT
        with open(txt_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        updated_count = 0
        
        header = lines[0]
        new_lines.append(header)
        
        for line in lines[1:]:
            parts = line.split('\t')
            if len(parts) > 4:
                name = parts[0]
                n_norm = normalize_name(name)
                
                if n_norm in j_map:
                    j_item = j_map[n_norm]
                    
                    # 1. Update Characteristic
                    # JSON 'character' usually has "Lp (2) B. 15s"
                    # JSON 'range' has "18"
                    # We want "Lp (2) B. 15s 18M"
                    
                    base_char = j_item.get('character', '').strip()
                    rng = j_item.get('range')
                    
                    if base_char:
                        full_char = base_char
                        # Append Range if not present
                        # Check if 'M' is already there? usually not in the base example
                        if rng:
                            # Append " 18M"
                            # Avoid double numeric if base_char ends with number?
                            # base: "15s" -> "15s 18M" ok.
                            full_char += f" {rng}M"
                            
                        # Update column index 3 (0-based)
                        parts[3] = full_char
                        
                    # 2. Update Description? (Height was already added, but double check)
                    # We did a good job describing "Farol branco, Altura Xm".
                    # Let's LEAVE description alone if it was already fixed by our grammar script.
                    # Or should we re-generate from THIS json which might be cleaner?
                    # The user said "complemente dados".
                    # The JSON description is actually sometimes weird: "Torre quadrangular Setor de visibili em treliça metálica, dade"
                    # Our generated descriptions "Farol branco, Altura 50m" are likely cleaner.
                    # ONLY update Characteristic because that was missing Period and Range.
                    
                    updated_count += 1
                    
                line = '\t'.join(parts)
                if not line.endswith('\n'): line += '\n'
            
            new_lines.append(line)
            
        with open(txt_path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        print(f"Complemented {updated_count} lighthouses with new characteristics (Period/Range).")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process()
