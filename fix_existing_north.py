
path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

targets = [
    "Ponta da Tijoca",
    "Taipu",
    "Soure",
    "Salvaterra",
    "Salinópolis",
    "Apeú"
]

def fix():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        fixed_count = 0
        
        for line in lines:
            parts = line.split('\t')
            if len(parts) > 1:
                name = parts[0]
                lat = parts[1]
                
                matched = False
                for t in targets:
                    if t.lower() == name.lower() or (t.lower() in name.lower() and len(name) < len(t) + 5):
                        matched = True
                        break
                
                if matched and 'N' in lat:
                    # Replace N with S
                    new_lat = lat.replace('N', 'S')
                    print(f"Fixing {name}: {lat} -> {new_lat}")
                    
                    # Reconstruct line
                    parts[1] = new_lat
                    line = '\t'.join(parts)
                    fixed_count += 1
            
            new_lines.append(line)
            
        if fixed_count > 0:
            with open(path, 'w', encoding='utf-8') as f:
                f.writelines(new_lines)
            print(f"Fixed {fixed_count} entries.")
        else:
            print("No entries found to fix.")
            
    except Exception as e:
        print(e)

if __name__ == "__main__":
    fix()
