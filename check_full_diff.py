
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\lighthousesbr_new.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def normalize(s):
    return s.strip().lower()

def check():
    with open(json_path, 'r', encoding='utf-8') as f:
        j_data = json.load(f)
    with open(txt_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()[1:] # skip header

    # Build maps
    j_map = {normalize(x['name']): x for x in j_data}
    t_map = {}
    for l in lines:
        p = l.split('\t')
        if len(p)>1:
            t_map[normalize(p[0])] = p

    # Compare
    diffs = []
    
    for name, t_parts in t_map.items():
        if name in j_map:
            j_item = j_map[name]
            
            # Compare Desc
            t_desc = t_parts[4].strip() if len(t_parts)>4 else ""
            j_desc = j_item.get('description', '').strip()
            
            if t_desc != j_desc:
                diffs.append(f"DESC [{name}]: TXT='{t_desc}' != JSON='{j_desc}'")
                
            # Compare Char
            t_char = t_parts[3].strip() if len(t_parts)>3 else ""
            j_char = j_item.get('character', '').strip() # JSON key might be 'character'
            
            if t_char != j_char:
                diffs.append(f"CHAR [{name}]: TXT='{t_char}' != JSON='{j_char}'")
                
    if diffs:
        print(f"Found {len(diffs)} differences.")
        for d in diffs[:10]:
            print(d)
    else:
        print("No differences found in Descriptions or Characteristics.")

if __name__ == "__main__":
    check()
