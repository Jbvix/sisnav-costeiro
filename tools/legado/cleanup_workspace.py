
import os
import shutil

root_dir = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro'
target_dir = os.path.join(root_dir, '_arquivos_temporarios')

files_to_move = [
    # Scripts
    "add_all_lighthouses.py", "add_lighthouses.py", "analyze_duplicates.py", "append_missing.py",
    "check_all_tags.py", "check_full_diff.py", "check_north.py", "check_pdf.py", "check_removals.py",
    "check_state_tags.py", "check_targets.py", "compare_lighthouses_v2.py", "compare_lighthouses_v3.py",
    "compare_new_json.py", "complement_data.py", "extract_lighthouses.py", "fix_and_dedupe.py",
    "fix_existing_north.py", "fix_grammar.py", "fix_sort.py", "group_lighthouses.py", "inspect_csv.py",
    "inspect_desc_tags.py", "inspect_json.py", "inspect_json_keys.py", "inspect_new_json.py",
    "inspect_pa.py", "inspect_pa_v2.py", "merge_lighthouses.py", "normalize_coords.py",
    "read_pdf_content.py", "refine_descriptions.py", "remove_lighthouses.py", "replace_file.py",
    "sort_lighthouses.py", "test_regex.py",
    
    # Text Reports (Root ones)
    "missing_lighthouses_grouped.txt", "missing_lighthouses_report.txt",
    
    # Old Deploy Zip
    "sisnav_deploy.zip"
]

def move_files():
    if not os.path.exists(target_dir):
        os.makedirs(target_dir)
        print(f"Created directory: {target_dir}")
        
    count = 0
    for filename in files_to_move:
        src = os.path.join(root_dir, filename)
        dst = os.path.join(target_dir, filename)
        
        if os.path.exists(src):
            try:
                shutil.move(src, dst)
                print(f"Moved: {filename}")
                count += 1
            except Exception as e:
                print(f"Error moving {filename}: {e}")
        else:
            # Silent skip if not found (maybe deleted or renamed)
            pass
            
    print(f"Finished moving {count} files to '_arquivos_temporarios'.")

if __name__ == "__main__":
    move_files()
