
import json
import unicodedata

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'
report_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\missing_lighthouses_report.txt'

def fix_mojibake(text):
    try:
        return text.encode('latin1').decode('utf-8')
    except:
        return text

def normalize(name):
    if not name:
        return ""
    # Fix encoding if broken
    name = fix_mojibake(name)
    
    # Normalize unicode characters
    name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII')
    name = name.lower()
    
    # Remove common prefixes
    prefixes = ["farol de ", "farol da ", "farol do ", "farol "]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
            
    # Remove stopwords for loose comparison
    stopwords = [" da ", " do ", " de ", " dos ", " das "]
    for sw in stopwords:
        name = name.replace(sw, " ")
        
    # Remove whitespace
    name = " ".join(name.split())
    return name

def process():
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
    except Exception as e:
        print(f"Error reading TXT: {e}")
        return

    missing_lighthouses = []
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        elements = data.get('elements', [])
        for el in elements:
            tags = el.get('tags', {})
            name = tags.get('name')
            if name:
                # Fix mojibake for display
                display_name = fix_mojibake(name)
                norm_name = normalize(name)
                
                if norm_name not in monitor_names:
                    missing_lighthouses.append(display_name)
                    
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(f"Total entries in JSON: {len(elements)}\n")
            f.write(f"Missing in MONITOR: {len(missing_lighthouses)}\n")
            f.write("\n--- Missing Lighthouses ---\n")
            for m in sorted(missing_lighthouses):
                f.write(m + '\n')
                
        print(f"Report written to {report_path}")
        print(f"Found {len(missing_lighthouses)} missing lighthouses.")

    except Exception as e:
        print(f"Error reading JSON: {e}")

if __name__ == "__main__":
    process()
