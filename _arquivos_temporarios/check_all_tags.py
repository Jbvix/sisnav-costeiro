
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'

try:
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    elements = data.get('elements', [])
    state_counts = {}
    
    for el in elements:
        tags = el.get('tags', {})
        state = tags.get('addr:state') or tags.get('is_in:state') or tags.get('is_in')
        if state:
            state_counts[state] = state_counts.get(state, 0) + 1
            
    print(f"Total elements: {len(elements)}")
    print(f"Elements with any state info: {sum(state_counts.values())}")
    print("State counts:", state_counts)
    
except Exception as e:
    print(f"Error: {e}")
