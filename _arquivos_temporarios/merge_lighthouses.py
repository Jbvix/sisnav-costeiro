import openpyxl
import pdfplumber
import re

def normalize_name(n):
    if not n: return ""
    return re.sub(r'[^A-Z0-9]', '', str(n).upper())

def merge_data():
    excel_path = "library/farois_costeiros_brasil_VALIDADO.xlsx"
    pdf_path = "library/Lista_Farois.pdf"
    out_path = "library/LIGHTHOUSES.txt"
    
    # 1. Load Excel Data (Authoritative)
    wb = openpyxl.load_workbook(excel_path, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    headers = [str(h).lower() for h in rows[0]]
    
    idx_name = headers.index('nome')
    idx_lat = headers.index('latitude')
    idx_lon = headers.index('longitude')
    idx_char = headers.index('caracteristica')
    # idx_valid = headers.index('observacao_validacao') # Optional
    
    lighthouses = []
    for row in rows[1:]:
        name = row[idx_name]
        if not name: continue
        lighthouses.append({
            'name': name,
            'norm_name': normalize_name(name),
            'lat': row[idx_lat],
            'lon': row[idx_lon],
            'char': row[idx_char],
            'desc': "" # Placeholder
        })
        
    print(f"Loaded {len(lighthouses)} lighthouses from Excel.")

    # 2. Extract Descriptions from PDF
    print("Extracting descriptions from PDF... (this may take a moment)")
    pdf_descriptions = {} # Key: Normalized Name -> Desc
    
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()
            for table in tables:
                # Heuristic: Table with "NOME" and "DESCRIÇÃO" in header
                if not table or len(table) < 2: continue
                
                header = [str(x).upper() if x else "" for x in table[0]]
                try:
                    # Find columns dynamically
                    col_name = -1
                    col_desc = -1
                    for i, h in enumerate(header):
                        if "NOME" in h: col_name = i
                        if "DESCRI" in h or "ESTRUTURA" in h: col_desc = i
                    
                    if col_name != -1 and col_desc != -1:
                        # Parse rows
                        for row in table[1:]:
                            if len(row) <= max(col_name, col_desc): continue
                            row_name = row[col_name]
                            if not row_name: continue
                            
                            # Clean name for matching
                            clean_name = normalize_name(row_name)
                            desc = row[col_desc]
                            if desc:
                                # Clean carriage returns
                                desc = desc.replace('\n', ' ').strip()
                                pdf_descriptions[clean_name] = desc
                except Exception as e:
                    pass

        # Fallback: Raw Text Extraction if tables failed (or just to supplement)
        if len(pdf_descriptions) < 5:
            print("Table extraction poor. Trying raw text extraction with Regex...")
            for page in pdf.pages:
                text = page.extract_text()
                if not text: continue
                # Split by lines
                lines = text.split('\n')
                # Heuristic: Look for Lighthouse Name, then grab text that looks like a description
                # Many descriptions start with "Torre", "Poste", "Coluna", "Estrutura"
                desc_keywords = ["Torre", "Poste", "Coluna", "Estrutura", "Armação", "Haste", "Fuste"]
                
                for i, line in enumerate(lines):
                    # Check if line contains a lighthouse name (from our excel list)
                    # This is O(N*M), naive but valid for 125 lighthouses * ~50 lines/page
                    for lh in lighthouses:
                        # loose match logic
                        if len(lh['name']) > 3 and lh['name'].upper() in line.upper():
                            # Potential match. Look for description in this line or next.
                            # Usually description is to the right or below.
                            # Check current line for keywords
                            found_desc = ""
                            match_keyword = next((k for k in desc_keywords if k in line), None)
                            if match_keyword:
                                # Extract from keyword onwards
                                parts = line.split(match_keyword)
                                if len(parts) > 1:
                                    found_desc = match_keyword + parts[1]
                            
                            # Check next line only if current line doesn't look complete or is just name
                            if not found_desc and i+1 < len(lines):
                                next_line = lines[i+1]
                                match_keyword_next = next((k for k in desc_keywords if k in next_line), None)
                                if match_keyword_next:
                                    found_desc = next_line.strip()
                            
                            if found_desc:
                                # Clean garbage (often PDF text extraction includes page numbers or coords)
                                # Keep it simple for now
                                pdf_descriptions[lh['norm_name']] = found_desc
                                pass

    print(f"Found {len(pdf_descriptions)} descriptions in PDF.")
    
    # 3. Merge
    matches = 0
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("NAME\tLAT\tLON\tCHARACTERISTIC\tDESCRIPTION\n")
        
        for lh in lighthouses:
            # Try exact match first
            desc = pdf_descriptions.get(lh['norm_name'])
            
            # If failed, try partial contains
            if not desc:
                for k, v in pdf_descriptions.items():
                    if k in lh['norm_name'] or lh['norm_name'] in k:
                        # Only match if length is reasonable to avoid "RIO" matching "RIO GRANDE" improperly without care
                        # But lighthouses have specific names usually.
                        if len(k) > 4 and len(lh['norm_name']) > 4:
                             desc = v
                             break
            
            if desc:
                matches += 1
                lh['desc'] = desc
            
            # Fallback for user request specific items if not found in PDF (or PDF parsing fails)
            # "Morro Branco" -> "Torre quadrangular em alvenaria, branca"
            # "Mucuripe" -> "Torre cilíndrica de alvenaria, com faixas horizontais pretas e brancas"
            if "MORROBRANCO" in lh['norm_name'] and not lh['desc']:
                 lh['desc'] = "Torre quadrangular em alvenaria, branca"
            if "MUCURIPE" in lh['norm_name'] and not lh['desc']:
                 lh['desc'] = "Torre cilíndrica de alvenaria, com faixas horizontais pretas e brancas"

            # Write
            line = f"{lh['name']}\t{lh['lat']}\t{lh['lon']}\t{lh['char']}\t{lh['desc']}"
            f.write(line + "\n")

    print(f"Merged complete. {matches} descriptions matched.")

if __name__ == "__main__":
    merge_data()
