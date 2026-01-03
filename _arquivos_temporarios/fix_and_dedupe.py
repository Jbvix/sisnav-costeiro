
path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def normalize(name):
    # Simple normalization for comparison
    return name.lower().replace('ã', 'a').replace('ç', 'c').replace('á', 'a').replace('é', 'e').replace('í', 'i').replace('ó', 'o').replace('ú', 'u')

def process():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # We need to perform specific merge/fix actions
        # 1. Map existing entries
        # 2. Identify duplicates to remove
        # 3. Identify entries to update (N -> S)
        
        # Specific Targets to Fix (N -> S) and Merge
        # (Target Name Substring, Preferred Name)
        targets_to_fix = {
            "ponta maria": "Ponta Maria", # Will align with Ponta Maria Teresa if needed, but keeping original name for now
            "curuça": "Curuçá",
            "curuca": "Curuçá",
            "ilha camaleao": "Ilha Camaleão", 
            "ilha camaleão": "Ilha Camaleão"
        }
        
        # Duplicates to remove (Imported ones that match above)
        # e.g. "Camaleao" (Imported), "Ponta Maria Teresa" (Imported)
        # We will scan and if we see an "Importado" entry that basically matches a "Real" entry, we drop the Imported one.
        
        final_lines = []
        original_entries = [] # Indices of original entries to keep/update
        lines_to_skip = set()
        
        # First pass: Index regular vs imported
        # We want to identify the "Original" (Line 1..126 roughly, or just Description != "Importado")
        
        originals = {} # map normalized name -> list of indices
        imported = {}
        
        for i, line in enumerate(lines):
            if i == 0: continue
            parts = line.split('\t')
            if len(parts) < 2: continue
            
            name = parts[0]
            desc = parts[4].strip() if len(parts) > 4 else ""
            norm = normalize(name)
            
            is_import = "Importado do OSM" in desc or desc == "N/D" or desc == "" # Assuming empty is usually bad/new? 
            # Actually N/D might be valid import or old.
            # Explicit look for "Importado do OSM"
            if "Importado do OSM" in desc:
                if norm not in imported: imported[norm] = []
                imported[norm].append(i)
            else:
                if norm not in originals: originals[norm] = []
                originals[norm].append(i)

        # Logic: 
        # For "Camaleao": Original "Ilha Camaleão" exists. Import "Camaleao" exists.
        # Normalize: "ilha camaleao".
        # Import "Camaleao" -> "camaleao".
        # They don't match strictly.
        
        # Let's do specific manual fixes based on user request first, then write remaining.
        
        # Manual Fix & Merge List
        # 1. Ilha Camaleão (Lines ~8) -> Flip N to S.
        # 2. Curuçá (Line ~15) -> Flip N to S.
        # 3. Ponta Maria (Line ~12) -> Flip N to S.
        
        # Removals
        # 4. Remove "Camaleao" (Imported) if present.
        # 5. Remove "Ponta Maria Teresa" (Imported) if present.
        
        lines_to_remove_indices = set()
        
        for i, line in enumerate(lines):
            parts = line.split('\t')
            if len(parts) > 1:
                name = parts[0]
                lat = parts[1]
                desc = parts[4].strip() if len(parts) > 4 else ""
                
                # Check for "Importado" duplication of our specific targets
                if "Importado do OSM" in desc:
                    n_low = name.lower()
                    if "camaleao" in n_low and "ilha" not in n_low:
                        # Likely "Camaleao" duplicate of "Ilha Camaleão"
                        print(f"Removing duplicate: {name}")
                        lines_to_remove_indices.add(i)
                    elif "maria teresa" in n_low:
                        # Likely duplicate of "Ponta Maria"
                        print(f"Removing duplicate: {name}")
                        lines_to_remove_indices.add(i)
                    elif "curuca" in n_low: # Just in case
                        print(f"Removing duplicate: {name}")
                        lines_to_remove_indices.add(i)

        # Building output
        output_lines = []
        for i, line in enumerate(lines):
            if i in lines_to_remove_indices:
                continue
                
            parts = line.split('\t')
            if len(parts) > 1:
                name = parts[0]
                lat = parts[1]
                
                # Apply N->S fixes for specific targets
                fix_targets = ["Ponta Maria", "Curuçá", "Ilha Camaleão", "Ilha Camaleao"]
                should_fix = False
                for t in fix_targets:
                    if t.lower() in name.lower():
                        should_fix = True
                        break
                
                if should_fix and 'N' in lat:
                    print(f"Flipping {name} to South")
                    parts[1] = lat.replace('N', 'S')
                    line = '\t'.join(parts)
            
            output_lines.append(line)
            
        with open(path, 'w', encoding='utf-8') as f:
            f.writelines(output_lines)
            
        print("Completed fixes and duplications removal.")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    process()
