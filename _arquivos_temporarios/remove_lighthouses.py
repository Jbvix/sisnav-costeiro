
path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

# Exact lines to remove based on check result:
# Line 131: Ponta Alegre 32°24.88' S
# Line 155: Boa Esperança 20°43.08' S
# Line 181: FAROL 23°10.86' S
# Line 241: Moronas 03°04.27' S

indices_to_remove = [131, 155, 181, 241]

# Indices are 1-based in report, so 0-based in list: 130, 154, 180, 240
# BUT, iterating and removing shifts indices. Better to read all, filter by content match found, then write.

targets = [
    ("Ponta Alegre", "32°24.88' S"),
    ("Boa Esperança", "20°43.08' S"),
    ("FAROL", "23°10.86' S"),
    ("Moronas", "03°04.27' S")
]

def remove():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        removed_count = 0
        
        for line in lines:
            parts = line.split('\t')
            if len(parts) > 1:
                name = parts[0]
                lat = parts[1]
                
                match = False
                for t_name, t_lat in targets:
                    # Strict match on name start and lat substring
                    if t_name in name and t_lat in lat:
                        match = True
                        print(f"Removing: {name} {lat}")
                        break
                
                if match:
                    removed_count += 1
                    continue
            
            new_lines.append(line)
            
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        print(f"Removed {removed_count} entries.")

    except Exception as e:
        print(e)

if __name__ == "__main__":
    remove()
