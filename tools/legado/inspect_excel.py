import openpyxl
import sys

try:
    path = "library/farois_costeiros_brasil_VALIDADO.xlsx"
    wb = openpyxl.load_workbook(path, data_only=True)
    sheet = wb.active
    
    print(f"Sheet Name: {sheet.title}")
    
    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        print("Empty file")
        sys.exit(0)
        
    print(f"Total Rows: {len(rows)}")
    print("--- HEADERS ---")
    for i, h in enumerate(rows[0]):
        print(f"{i}: {h}")
    
    print("--- ROW 1 ---")
    if len(rows) > 1:
        print(rows[1])
        
except Exception as e:
    print(f"Error: {e}")
