
path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

targets_names = ["Boa Esperança", "FAROL", "Ponta Alegre", "Moronas"]
targets_coords = ["03°04.27' S", "32°24.88' S", "20°43.08' S", "23°10.86' S"]

def check_remove():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        print(f"{'Line':<4} | {'Name':<30} | {'Lat':<15}")
        print("-" * 55)
        
        for i, line in enumerate(lines):
            parts = line.split('\t')
            if len(parts) > 1:
                name = parts[0]
                lat = parts[1]
                
                matched = False
                for t in targets_names:
                    if t.lower() in name.lower():
                        matched = True
                        break
                
                if not matched:
                    for c in targets_coords:
                        if c in lat:
                            matched = True
                            break
                            
                if matched:
                    print(f"{i+1:<4} | {name[:30]:<30} | {lat:<15}")

    except Exception as e:
        print(e)

if __name__ == "__main__":
    check_remove()
