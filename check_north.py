
path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

pa_names = [
"banco coroa grande", "boco do furo", "boiucu", "caete", "camaleao", "camapijo", 
"cascalheira", "colares", "belém", "ilha cameleao", "ilha cotijuba", 
"ilha joroca", "ilha jupatituba", "ilha jutuba", "ilha mandi", "ilha tatuoca", 
"ilha das araras", "ilha do apeu", "ilha do capim", "ilha do machadinho", 
"ilha dos amores", "itaguary", "joanes", "machadinho", 
"pedra da manteiga", "marapanim", "maria teresa", 
"chapeu virado", "ponto de santana", "quatipuru", "rio arari", "rio arrozal",
"tijoca", "taipu", "soure", "salvaterra", "curuça", "salinópolis", "apeú"
]

def check():
    try:
        with open(path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        print(f"{'Name':<30} | {'Lat':<15}")
        print("-" * 45)
        
        count = 0 
        for line in lines[1:]:
            parts = line.split('\t')
            if not parts: continue
            name = parts[0]
            lat = parts[1]
            
            # Check if Lat has 'N'
            if 'N' in lat:
                # Check if it matches a PA name
                matched = False
                n_low = name.lower()
                for p in pa_names:
                    if p in n_low:
                        matched = True
                        break
                
                if matched:
                    print(f"{name:<30} | {lat:<15}")
                    count += 1
        
        print(f"\nPotential errors found: {count}")
        
    except Exception as e:
        print(e)
        
if __name__ == "__main__":
    check()
