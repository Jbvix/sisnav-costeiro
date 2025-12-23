
import os
import json
import glob
from parse_gpx import parse_gpx

def build_index(gpx_dir, output_file):
    print(f"Building Route Index from: {gpx_dir}")
    
    all_routes = []
    
    # 1. Busca todos os arquivos .gpx
    gpx_files = glob.glob(os.path.join(gpx_dir, "*.gpx"))
    print(f"Found {len(gpx_files)} GPX files.")
    
    for gpx_path in gpx_files:
        try:
            # Reutiliza o parser existente
            result = parse_gpx(gpx_path)
            
            if result and result.get('route'):
                # Simplifica estrutura para o Index (economizar banda)
                # Guarda apenas metadados e coordenadas
                
                # Extrai pontos
                simple_points = [
                    {"lat": pt['lat_dec'], "lon": pt['lon_dec']} 
                    for pt in result['route']
                ]
                
                # Metadados úteis para o roteador ("De Onde -> Para Onde")
                # Heurística: Nome do arquivo é "Origem x Destino.gpx"
                filename = os.path.basename(gpx_path).replace('.gpx', '').lower()
                parts = filename.split(' x ')
                
                meta = {
                    "id": filename,
                    "origin": parts[0].strip() if len(parts) > 0 else "?",
                    "destination": parts[1].strip() if len(parts) > 1 else "?",
                    "points": simple_points
                }
                
                all_routes.append(meta)
                print(f"Indexado: {filename} ({len(simple_points)} pts)")
                
        except Exception as e:
            print(f"Falha ao indexar {gpx_path}: {e}")

    # 2. Salva JSON
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(all_routes, f, ensure_ascii=False)
        
    print(f"Index salvo (JS Compatible): {output_file}")
    # Cria wrapper JS para facilitar importação no browser sem fetch (opcional, mas útil localmente)
    # ou salvamos apenas como .json e deixamos o frontend carregar via fetch (se tiver server).
    # Como estamos rodando python -m http.server, fetch funciona.

if __name__ == "__main__":
    BASE_DIR = os.getcwd()
    GPX_DIR = os.path.join(BASE_DIR, 'gpx')
    OUTPUT_FILE = os.path.join(BASE_DIR, 'js', 'data', 'known_routes.json')
    
    build_index(GPX_DIR, OUTPUT_FILE)
