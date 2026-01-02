
import json

json_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\osm_lighthouses_v2.json'

try:
    with open(json_path, 'r', encoding='utf-16') as f:
        data = json.load(f)
    
    elements = data.get('elements', [])
    state_tags = 0
    total = len(elements)
    
    print(f"Total elements: {total}")
    
    sample_states = set()
    for el in elements[:50]: # Check first 50
        tags = el.get('tags', {})
        state = tags.get('addr:state') or tags.get('is_in:state') or tags.get('is_in')
        if state:
            state_tags += 1
            sample_states.add(state)
            
    print(f"Elements with state tags in first 50: {state_tags}")
    print(f"Sample states found: {sample_states}")
    
except Exception as e:
    print(f"Error: {e}")
