
import json
import os

path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\lighthousesbr_new.json'

def inspect():
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return

    try:
        with open(path, 'r', encoding='utf-8') as f:
            # Try loading as standard JSON
            try:
                data = json.load(f)
            except json.JSONDecodeError:
                # Might be line-delimited or have issues, let's peek text
                f.seek(0)
                print("Raw content head:")
                print(f.read(500))
                return

        print(f"Type: {type(data)}")
        if isinstance(data, list):
            print(f"Count: {len(data)}")
            if len(data) > 0:
                print("Sample Entry:")
                print(json.dumps(data[0], indent=2, ensure_ascii=False))
        elif isinstance(data, dict):
            print(f"Keys: {list(data.keys())}")
            # Peek deeper if it has a common wrapper key like 'features' or 'elements'
            for k in ['features', 'elements', 'lighthouses']:
                if k in data:
                    print(f"Found key '{k}' with length {len(data[k])}")
                    if len(data[k]) > 0:
                        print("Sample Entry:")
                        print(json.dumps(data[k][0], indent=2, ensure_ascii=False))
                    break
            else:
                # Just print a slice of the dict if small, or first key
                k = list(data.keys())[0]
                print(f"Sample content for key '{k}': {str(data[k])[:200]}")

    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    inspect()
