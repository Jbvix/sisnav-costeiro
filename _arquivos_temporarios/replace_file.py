
import csv
import re

src_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSESBR.txt'
dst_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def fix_encoding(text):
    # Fix common mojibake manually if possible, or try latin1 -> utf8
    # "04Â°25.86'" suggests UTF-8 interpreted as Latin1/Windows-1252?
    # Actually if it shows Â° in PowerShell, it might be UTF-8 printed to CP850 or similar.
    # We should read as UTF-8.
    try:
        return text.encode('latin1').decode('utf-8')
    except:
        return text

def convert():
    try:
        # Check separators. Line 1 says "name lat ..." separated by tabs?
        # Sample output showed "name    lat"
        
        with open(src_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
        # The sample showed "04Â°". This implies the file ON DISK is UTF-8 but my display showed it funny?
        # Or file is Latin1.
        # Let's try reading as UTF-8 first.
        
        lines = content.splitlines()
        if not lines: return

        # Detect separator. Sample looked like tabs.
        header = lines[0].lower()
        sep = '\t' if '\t' in header else ' '
        # Actually header has many spaces? "name    lat"
        # Since I can't be sure, I will parse logic.
        
        # New standard columns: NAME, LAT, LON, CHARACTERISTIC, DESCRIPTION
        # Source columns: name, lat, lon, height, range, character, description
        
        new_rows = []
        new_rows.append("NAME\tLAT\tLON\tCHARACTERISTIC\tDESCRIPTION")
        
        # Skip header
        
        for line in lines[1:]:
            line = line.strip()
            if not line: continue
            
            # Simple split by tab if tab-delimited
            parts = line.split('\t')
            
            # If parts are few, maybe fixed width or spaces?
            # Let's assume tabs based on "txt" convention here.
            
            # Mapping assuming order: name, lat, lon, height, range, character, description
            # If source has 7 columns
            
            p_name = parts[0] if len(parts) > 0 else ""
            p_lat = parts[1] if len(parts) > 1 else ""
            p_lon = parts[2] if len(parts) > 2 else ""
            p_height = parts[3] if len(parts) > 3 else ""
            p_range = parts[4] if len(parts) > 4 else ""
            p_char = parts[5] if len(parts) > 5 else ""
            p_desc = parts[6] if len(parts) > 6 else ""
            
            # Construct Target Characteristic: Char + Range
            # Example: "Lp (2) B. 15s" + "18" -> "Lp (2) B. 15s 18M"
            
            full_char = p_char
            if p_range and p_range.strip() != "0":
                full_char += f" {p_range}M"
            
            # Construct Target Description: Description + Height?
            # Use raw description?
            full_desc = p_desc
            # Ensure "Farol" or "Torre" structure if missing?
            # User probably verified this content.
            
            # Append Row
            new_rows.append(f"{p_name}\t{p_lat}\t{p_lon}\t{full_char}\t{full_desc}")

        with open(dst_path, 'w', encoding='utf-8') as f:
            f.write('\n'.join(new_rows))
            
        print(f"Replaced LIGHTHOUSES.txt with content from LIGHTHOUSESBR.txt ({len(new_rows)-1} entries).")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    convert()
