
import json
import unicodedata

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'
report_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\missing_lighthouses_grouped.txt'

def fix_mojibake(text):
    try:
        return text.encode('latin1').decode('utf-8')
    except:
        return text

def normalize(name):
    if not name: return ""
    name = fix_mojibake(name)
    name = unicodedata.normalize('NFKD', name).encode('ASCII', 'ignore').decode('ASCII')
    name = name.lower()
    prefixes = ["farol de ", "farol da ", "farol do ", "farol "]
    for p in prefixes:
        if name.startswith(p):
            name = name[len(p):]
            break
    stopwords = [" da ", " do ", " de ", " dos ", " das "]
    for sw in stopwords:
        name = name.replace(sw, " ")
    return " ".join(name.split())

def get_state(lat, lon):
    # Coarse classification for Brazil Coastal Lighthouses
    # Note: Very simplified!
    
    if lat > 0:
        if lon > -30: return "PE (Arquipelago - St Peter)" 
        return "AP" # Amapá
    
    # South of Equator
    if lat > -2.5:
        if lon > -46: return "MA"
        return "PA" # Pará
    
    if lat > -3.2:
        if lon > -41.5: return "CE"
        return "MA" 
        
    if lat > -4.8:
        if lon > -34: return "RN (Rocas/Noronha)"
        if lon > -38: return "RN" 
        return "CE"
        
    if lat > -6.5: return "RN"
    if lat > -7.6: return "PB"
    if lat > -9.0: return "PE"
    if lat > -10.5: return "AL"
    if lat > -11.6: return "SE"
    
    if lat > -18.2: return "BA"
    if lat > -21.2: return "ES"
    
    if lat > -23.5:
        if lon > -44.8: return "RJ"
        return "SP"
        
    if lat > -25.5: return "SP"
    if lat > -26.0: return "PR"
    if lat > -29.4: return "SC"
    
    if lat <= -29.4: return "RS"
    
    return "Unknown"

def process():
    # 1. Load Monitor Names
    monitor_names = set()
    try:
        with open(txt_path, 'r', encoding='utf-8') as f:
            for line in f.readlines()[1:]:
                parts = line.split('\t')
                if parts:
                    n = normalize(parts[0])
                    if n: monitor_names.add(n)
    except Exception as e:
        print(f"Error reading TXT: {e}")
        return

    # 2. Analyze JSON
    missing_by_state = {}
    
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        elements = data.get('elements', [])
        for el in elements:
            tags = el.get('tags', {})
            name = tags.get('name')
            
            if name:
                norm = normalize(name)
                if norm not in monitor_names:
                    display_name = fix_mojibake(name)
                    lat = el.get('lat')
                    lon = el.get('lon')
                    
                    state = "No Location"
                    if lat is not None and lon is not None:
                        state = get_state(float(lat), float(lon))
                        
                    if state not in missing_by_state:
                        missing_by_state[state] = []
                    
                    missing_by_state[state].append(display_name)
                    
        # 3. Write Report
        with open(report_path, 'w', encoding='utf-8') as f:
            f.write(f"Missing Lighthouses Grouped by State\n")
            f.write("====================================\n\n")
            
            # Sort states nicely? North to South logic or Alpha
            # Let's do rough North to South based on my logic keys
            order = ["AP", "PA", "MA", "CE", "RN", "RN (Rocas/Noronha)", "PB", "PE", 
                     "PE (Arquipelago - St Peter)", "AL", "SE", "BA", "ES", "RJ", "SP", 
                     "PR", "SC", "RS", "Unknown"]
            
            # Get actual keys present
            present_keys = sorted(missing_by_state.keys())
            
            # Use defined order if possible, otherwise append at end
            final_order = [k for k in order if k in present_keys] + [k for k in present_keys if k not in order]
            
            for state in final_order:
                lighthouses = sorted(missing_by_state[state])
                f.write(f"## {state} ({len(lighthouses)})\n")
                for lh in lighthouses:
                    f.write(f"- {lh}\n")
                f.write("\n")
                
        print(f"Report written to {report_path}")

    except Exception as e:
        print(f"Error process JSON: {e}")

if __name__ == "__main__":
    process()
