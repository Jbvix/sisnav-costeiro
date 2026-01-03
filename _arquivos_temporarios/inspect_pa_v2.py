
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'

pa_targets = [
    "Banco Coroa Grande", "Boco do Furo", "Boiucu", "Caete", "Camaleao", "Camapijo", 
    "Cascalheira", "Colares", "Farol de Belém", "Ilha Cameleao", "Ilha Cotijuba", 
    "Ilha Joroca", "Ilha Jupatituba", "Ilha Jutuba", "Ilha Mandi", "Ilha Tatuoca", 
    "Ilha das Araras", "Ilha do Apeu", "Ilha do Capim", "Ilha do Machadinho", 
    "Ilha dos Amores, Salvaterra", "Itaguary", "Joanes", "Machadinho", 
    "Pedra da Manteiga", "Ponta Marapanim", "Ponta Maria Teresa", 
    "Ponta do Chapeu Virado", "Ponto de Santana", "Quatipuru", "Rio Arari", "Rio Arrozal"
]

def check_pa():
    try:
        with open(json_path, 'r', encoding='utf-16') as f:
            data = json.load(f)
            
        print(f"{'Name':<35} | {'Lat':<12} | {'Lon':<12}")
        print("-" * 65)
        
        # Build map to handle encoding mess strictly? No, loose match is better but print clear name
        
        for el in data.get('elements', []):
            tags = el.get('tags', {})
            name = tags.get('name', '')
            if not name: continue
            
            # Check if likely in our target list
            matched = False
            for t in pa_targets:
                if t.lower() in name.lower():
                    matched = True
                    break
            
            if matched:
                try:
                    display_name = name.encode('latin1').decode('utf-8')
                except:
                    display_name = name
                    
                lat = el.get('lat')
                lon = el.get('lon')
                print(f"{display_name[:35]:<35} | {lat:<12} | {lon:<12}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_pa()
