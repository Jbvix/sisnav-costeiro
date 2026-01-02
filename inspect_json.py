
import json

file_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'

try:
    with open(file_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    print("Keys:", data.keys())
    if "elements" in data:
        print(f"Number of elements: {len(data['elements'])}")
        if len(data['elements']) > 0:
            print("First element keys:", data['elements'][0].keys())
            if "tags" in data['elements'][0]:
                print("First element tags:", data['elements'][0]['tags'])
    
except Exception as e:
    print(f"Error: {e}")
