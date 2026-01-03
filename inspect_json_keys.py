
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\lighthousesbr_new.json'

def inspect_keys():
    try:
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        print(f"Total items: {len(data)}")
        if len(data) > 0:
            # Check keys of first few items
            keys_seen = set()
            for item in data[:50]:
                keys_seen.update(item.keys())
            
            print(f"Available keys: {sorted(list(keys_seen))}")
            
            # Show a sample with values
            print("\nSample values:")
            for item in data[:3]:
                print("-" * 20)
                for k, v in item.items():
                    print(f"{k}: {v}")
                    
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect_keys()
