import openpyxl

def extract():
    path = "library/farois_costeiros_brasil_VALIDADO.xlsx"
    out_path = "library/LIGHTHOUSES.txt"
    
    wb = openpyxl.load_workbook(path, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    
    # Header Mapping
    headers = [str(h).lower() for h in rows[0]]
    try:
        idx_name = headers.index('nome')
        idx_lat = headers.index('latitude')
        idx_lon = headers.index('longitude')
        idx_char = headers.index('caracteristica')
        # Try to find description column
        try:
            idx_desc = headers.index('descricao')
        except ValueError:
             # Fallback if specific name differs, try 'estrutura' or similar if needed. 
             # Based on user prompt "Torre...", it's likely 'descricao'.
             idx_desc = -1
    except ValueError as e:
        print(f"Error finding columns: {e}")
        return

    with open(out_path, 'w', encoding='utf-8') as f:
        f.write("NAME\tLAT\tLON\tCHARACTERISTIC\tDESCRIPTION\n")
        count = 0
        for row in rows[1:]:
            name = row[idx_name]
            lat = row[idx_lat]
            lon = row[idx_lon]
            char = row[idx_char]
            desc = row[idx_desc] if idx_desc != -1 else ""
            
            if name and lat and lon:
                # Clean / Format
                line = f"{name}\t{lat}\t{lon}\t{char if char else ''}\t{desc if desc else ''}"
                f.write(line + "\n")
                count += 1
                
    print(f"Extracted {count} lighthouses to {out_path}")

if __name__ == "__main__":
    extract()
