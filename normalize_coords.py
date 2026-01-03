
import re

path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def normalize():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        new_lines = []
        header = lines[0]
        new_lines.append(header)
        
        count = 0
        
        for line in lines[1:]:
            parts = line.split('\t')
            if len(parts) > 2:
                lat = parts[1]
                lon = parts[2]
                
                # Check Lon: 051° -> 51°
                # Regex to match leading zero in degrees
                # ^0+ leading, but typically "051°"
                # We can just parse float and reformat? Or string manipulation?
                # "051°32.52' W"
                
                if lon.startswith('0') and '°' in lon:
                    # Remove leading zero
                    # But be careful of 00° (Greenwich)? "000°"?
                    # If it's 00°.. it should be 0°? Or 00°?
                    # Previous file had "00°52.80'" for LAT.
                    # Previous file had "29°20.76'" for LON.
                    # So Lat keeps 2 digits (00, 04). Lon likely keeps 2 or 3?
                    # If Lon is 051, old was 51.
                    # If Lon is 009, old was 9?
                    # Let's try to just use int(deg) for formatting.
                    
                    deg_part, rest = lon.split('°')
                    try:
                        d_val = int(deg_part)
                        new_lon = f"{d_val:02d}°{rest}" # Force 2 digits?
                        # Wait, old file had "51°" (2 digits).
                        # "29°" (2 digits).
                        # What if 130°? 3 digits.
                        # What if 5°? "05°"?
                        # Let's look at "Penedos de São Pedro" Line 9 Step 539: "29°20.76' W"
                        # It seems 2 digits minimum is standard for Lat, maybe Lon too?
                        # But 3 digits for Lon is standard maritime.
                        # "051" -> "51" is safer if app converts string to number.
                        
                        # Let's just strip leading zero if it makes it 3 digits < 100?
                        # ie. "051" -> "51". "005" -> "05"?
                        if len(deg_part) == 3 and deg_part.startswith('0'):
                             new_lon = float(deg_part.lstrip('0')) # No, keep str
                             # Just use lstrip '0' but ensure empty string becomes '0'?
                             s_deg = deg_part.lstrip('0')
                             if not s_deg: s_deg = "0"
                             # But usually we want 2 digits pad?
                             # Let's match line 9 of step 539: "29°".
                             # So 2 digits is fine.
                             if len(s_deg) < 2: s_deg = "0" + s_deg
                             
                             new_lon = f"{s_deg}°{rest}"
                             parts[2] = new_lon
                             count += 1
                    except:
                        pass
                
                # Also check Lat? "04°" is fine.
            
            line = '\t'.join(parts)
            # Ensure no duplicates newlines logic from previous scripts
            if not line.endswith('\n'): line += '\n'
            new_lines.append(line)
            
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
            
        print(f"Normalized {count} longitude entries (removed leading zeros).")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    normalize()
