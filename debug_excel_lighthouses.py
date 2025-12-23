import openpyxl

def debug_rows():
    path = "library/farois_costeiros_brasil_VALIDADO.xlsx"
    wb = openpyxl.load_workbook(path, data_only=True)
    sheet = wb.active
    rows = list(sheet.iter_rows(values_only=True))
    
    headers = [str(h).lower() for h in rows[0]]
    print("HEADERS:", headers)

    targets = ["MORRO BRANCO", "MUCURIPE"]
    
    for row in rows[1:]:
        # Naive search in all columns for the name
        row_str = [str(c).upper() if c else "" for c in row]
        found = False
        for t in targets:
            if any(t in c for c in row_str):
                print(f"--- FOUND {t} ---")
                for i, cell in enumerate(row):
                    print(f"{i} ({headers[i] if i < len(headers) else '?'}): {cell}")
                found = True
        
if __name__ == "__main__":
    debug_rows()
