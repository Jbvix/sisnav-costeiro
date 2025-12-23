
import zipfile
import xml.etree.ElementTree as ET
import sys
import os
import re
import json

def extract_text_and_tables(docx_path):
    """
    Extracts text and tables from a DOCX file.
    Returns a list of strings (paragraphs) and list of lists (tables).
    """
    if not os.path.exists(docx_path):
        print(f"File not found: {docx_path}")
        return [], []

    try:
        with zipfile.ZipFile(docx_path) as zf:
            xml_content = zf.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            extracted_data = [] # List of dictionaries or strings
            
            body = tree.find('w:body', namespaces)
            if body is None:
                return [], []

            for element in body:
                tag = element.tag
                if tag.endswith('p'):
                    texts = [node.text for node in element.findall('.//w:t', namespaces) if node.text]
                    if texts:
                        extracted_data.append({'type': 'para', 'text': ''.join(texts)})
                
                elif tag.endswith('tbl'):
                    table_data = []
                    for row in element.findall('.//w:tr', namespaces):
                        row_cells = []
                        for cell in row.findall('.//w:tc', namespaces):
                            cell_texts = [node.text for node in cell.findall('.//w:t', namespaces) if node.text]
                            row_cells.append("".join(cell_texts).strip())
                        table_data.append(row_cells)
                    extracted_data.append({'type': 'table', 'data': table_data})
            
            return extracted_data

    except Exception as e:
        print(f"Error reading docx: {e}")
        return []

def parse_coordinate(coord_str):
    """
    Parses coordinate string like '23º07.358’S' or '043° 33,741 W' to Decimal Degrees.
    """
    # Normalize
    s = coord_str.replace(',', '.').upper().strip()
    
    # Regex: (Degrees)(Separator)(Minutes)(Suffix)
    # 23º07.358’S
    match = re.search(r'(\d+)[º°\s](\d+\.?\d*)[\'’]?\s*([NSEW])', s)
    
    if match:
        deg = float(match.group(1))
        min_val = float(match.group(2))
        hemi = match.group(3)
        
        decimal = deg + (min_val / 60.0)
        
        if hemi in ['S', 'W']:
            decimal *= -1
            
        return decimal
    return None

def extract_kv_from_tables(extracted_data):
    """
    Scans tables for Key-Value pairs based on known labels.
    """
    data = {
        "header": {},
        "technical": {},
        "trip": {},
        "crew": {},
        "safety": {},
        "route": []
    }

    # Mappings: Key in DOCX -> Key in JSON
    # We use 'contains' logic for keys
    key_map = {
        "REBOCADOR": ("header", "vessel"),
        "FILIAL": ("header", "branch"),
        "NÚMERO": ("header", "plan_number"),
        "DATA DA ELABORAÇÃO": ("header", "date"),
        "COMANDANTE": ("crew", "captain"),
        "TRIPULANTES": ("crew", "crew_count"),
        "PORTO DE ORIGEM": ("trip", "origin"),
        "PORTO DE DESTINO": ("trip", "destination"),
        "CALADO MÁXIMO DO REBOCADO": ("technical", "draft_max_tow"),
        "POPA": ("technical", "draft_aft"), # Be careful with duplicates
        "PROA": ("technical", "draft_fwd"),
        "VELOCIDADE MÁXIMA REBOCANDO": ("technical", "speed_towing"),
        "VELOCIDADE SEM REBOQUE": ("technical", "speed_free"),
        "ESTOQUE DE COMBUSTÍVEL TOTAL": ("trip", "fuel_total"),
        "COMBUSTÍVEL TOTAL REQUERIDO": ("trip", "fuel_required"),
        "DISTÂNCIA TOTAL": ("trip", "distance_total"),
        "TEMPO TOTAL": ("trip", "duration_total"),
        "AFASTAMENTO DA COSTA": ("safety", "gmdss_limit"),
        "OBSERVAÇÕES": ("safety", "obs")
    }
    
    # Process Tables for KV
    for item in extracted_data:
        if item['type'] == 'table':
            rows = item['data']
            for row in rows:
                # Iterate cells to find keys
                for i, cell in enumerate(row):
                    cell_upper = cell.upper()
                    
                    found_key = None
                    target_path = None

                    for k, path in key_map.items():
                        if k in cell_upper:
                            found_key = k
                            target_path = path
                            break
                    
                    if found_key:
                        # Value is usually in the NEXT cell (i+1)
                        if i + 1 < len(row):
                            val = row[i+1]
                            
                            # Specific handling for "Popa/Proa" which appear multiple times
                            # We check context or just overwrite (last one wins)
                            # Or we try to be smart about row structure. 
                            # For simplicity: extracting direct value.
                            
                            section, field = target_path
                            
                            # Clean specific chars
                            val_clean = val.replace(':', '').strip()
                            if val_clean:
                                data[section][field] = val_clean

    return data

def extract_route_from_tables(extracted_data):
    """
    Finds the Waypoints table and exacts route data.
    Heuristic: Look for row with 'LAT' and 'LONG' and 'NOME'.
    """
    route = []
    
    for item in extracted_data:
        if item['type'] == 'table':
            rows = item['data']
            
            header_idx = -1
            col_map = {} # 'lat': index, 'lon': index, ...
            
            # Find Attributes
            for r_idx, row in enumerate(rows):
                row_str = " ".join(row).upper()
                if "LAT" in row_str and "LONG" in row_str:
                    header_idx = r_idx
                    # Map columns
                    for c_idx, cell in enumerate(row):
                        c_upper = cell.upper()
                        if "NOME" in c_upper: col_map['name'] = c_idx
                        elif "LAT" in c_upper: col_map['lat'] = c_idx
                        elif "LONG" in c_upper: col_map['lon'] = c_idx
                        elif "CARTA" in c_upper or "CHART" in c_upper: col_map['chart'] = c_idx
                        elif "DIST" in c_upper: col_map['dist'] = c_idx
                        elif "RUM" in c_upper: col_map['course'] = c_idx
                    break
            
            if header_idx != -1 and 'lat' in col_map and 'lon' in col_map:
                # Process Data Rows
                for i in range(header_idx + 1, len(rows)):
                    row = rows[i]
                    if len(row) <= max(col_map.values()): continue # incomplete row
                    
                    lat_raw = row[col_map['lat']]
                    lon_raw = row[col_map['lon']]
                    
                    # Basic validation: looks like coord?
                    if not any(c.isdigit() for c in lat_raw): continue
                    
                    wp = {
                        "sequence": len(route) + 1,
                        "lat_raw": lat_raw,
                        "lon_raw": lon_raw,
                        "lat_dec": parse_coordinate(lat_raw),
                        "lon_dec": parse_coordinate(lon_raw)
                    }
                    
                    if 'name' in col_map: wp['name'] = row[col_map['name']]
                    if 'chart' in col_map: wp['chart'] = row[col_map['chart']]
                    if 'dist' in col_map: wp['dist'] = row[col_map['dist']]
                    if 'course' in col_map: wp['course'] = row[col_map['course']]
                    
                    if wp['lat_dec'] is not None and wp['lon_dec'] is not None:
                        route.append(wp)
                
                # Assume only one route table per doc
                if len(route) > 0:
                    break
                    
    return route

def main(file_path):
    extracted = extract_text_and_tables(file_path)
    
    # 1. KV Extraction
    final_data = extract_kv_from_tables(extracted)
    
    # 2. Route Extraction
    route_data = extract_route_from_tables(extracted)
    final_data['route'] = route_data
    
    # 3. Output JSON
    print(json.dumps(final_data, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse_travel_plan.py <path_to_docx>")
    else:
        main(sys.argv[1])
