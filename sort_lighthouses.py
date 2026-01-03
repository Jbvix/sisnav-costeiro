
import re

path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def parse_lat(lat_str):
    # Format: 04°25.78' N
    try:
        # cleanup
        lat_str = lat_str.strip()
        if not lat_str: return -999.0
        
        parts = re.split(r'[°\']', lat_str)
        if len(parts) >= 2:
            deg = float(parts[0])
            min_part = parts[1].strip()
            # sometimes minutes might have direction attached if not split correctly?
            # typically split by ' gives ["04", "25.78", " N"] or similar
            
            minute_val = 0.0
            direction = ""
            
            # Extract minute and direction
            remaining = parts[1].strip() + (parts[2] if len(parts)>2 else "")
            
            # Simple regex for digits and letters
            m = re.search(r'([\d\.]+)\s*([NS])', lat_str)
            if m:
                # This regex might fail if degrees are separate.
                pass
            
            # More robust parsing:
            # Split by degree symbol
            deg_part, rest = lat_str.split('°')
            deg = float(deg_part)
            
            # Rest is "25.78' N"
            min_part, hemi = rest.split("'")
            minute_val = float(min_part.strip())
            hemi = hemi.strip().upper()
            
            val = deg + (minute_val / 60.0)
            if hemi == 'S':
                val = -val
            return val
            
    except Exception as e:
        print(f"Error parsing lat '{lat_str}': {e}")
        return -999.0
    
    return -999.0

def sort_file():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            
        header = lines[0]
        data_lines = lines[1:]
        
        # Parse and store (line, lat_val)
        parsed = []
        for line in data_lines:
            parts = line.split('\t')
            if len(parts) > 1:
                lat_str = parts[1]
                val = parse_lat(lat_str)
                parsed.append((val, line))
            else:
                # Keep checking if empty lines matter? usually ignore or put at end
                parsed.append((-1000.0, line))
                
        # Sort descending (North positive -> South negative)
        # So 5.0 (N) > -1.0 (S) > -30.0 (S)
        parsed.sort(key=lambda x: x[0], reverse=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            f.write(header)
            for val, line in parsed:
                f.write(line)
                
        print(f"Sorted {len(parsed)} lighthouses from North to South.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    sort_file()
