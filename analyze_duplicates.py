
path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

targets = [
    "Ponta Maria", "Curuçá", "Camaleão", "Camaleao", "Curuca"
]

def analyze():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        print(f"{'Line':<4} | {'Name':<30} | {'Lat':<15} | {'Desc'}")
        print("-" * 70)
        
        for i, line in enumerate(lines):
            parts = line.split('\t')
            if len(parts) > 1:
                name = parts[0]
                lat = parts[1]
                desc = parts[4].strip() if len(parts) > 4 else ""
                
                matched = False
                for t in targets:
                    if t.lower() in name.lower():
                        matched = True
                        break
                
                if matched:
                    print(f"{i+1:<4} | {name[:30]:<30} | {lat:<15} | {desc}")

    except Exception as e:
        print(e)
        
if __name__ == "__main__":
    analyze()
