import csv
import shutil
import os
from datetime import datetime

# --- CONFIGURAÇÃO ---
INPUT_FILE = 'mares_2026_oficial.csv'  # Nome padrão do arquivo de entrada
TARGET_FILE = 'tides_scraped.csv'      # Arquivo alvo do sistema
BACKUP_FILE = 'tides_scraped_backup.csv'

# Mapeamento: "Nome no PDF/Entrada" -> "ID do Sistema" + "Nome CSV Oficial"
PORT_MAPPING = {
    # Mapeamentos baseados nos PDFs da biblioteca
    "SUAPE": {"id": "BR_SUA", "name": "Suape"},
    "PORTO DE SUAPE": {"id": "BR_SUA", "name": "Suape"},
    
    "MUCURIPE": {"id": "BR_FOR", "name": "Mucuripe"},
    "PORTO DE MUCURIPE": {"id": "BR_FOR", "name": "Mucuripe"},
    "FORTALEZA": {"id": "BR_FOR", "name": "Mucuripe"},
    
    "RECIFE": {"id": "BR_REC", "name": "Recife"},
    "PORTO DO RECIFE": {"id": "BR_REC", "name": "Recife"},
    
    "SALVADOR": {"id": "BR_SAL", "name": "Salvador"},
    "PORTO DE SALVADOR": {"id": "BR_SAL", "name": "Salvador"},
    
    "BELEM": {"id": "BR_BEL", "name": "Belém"},
    "PORTO DE BELEM": {"id": "BR_BEL", "name": "Belém"},
    
    "ITAQUI": {"id": "BR_ITQ", "name": "Itaqui"},
    "PORTO DE ITAQUI": {"id": "BR_ITQ", "name": "Itaqui"},
    
    "RIO DE JANEIRO": {"id": "BR_RIO", "name": "Rio de Janeiro"},
    "PORTO DO RIO DE JANEIRO": {"id": "BR_RIO", "name": "Rio de Janeiro"},
    
    "VITORIA": {"id": "BR_VIT", "name": "Vitória"},
    "PORTO DE VITORIA": {"id": "BR_VIT", "name": "Vitória"},
    
    "RIO GRANDE": {"id": "BR_RIG", "name": "Rio Grande"},
    "PORTO DO RIO GRANDE": {"id": "BR_RIG", "name": "Rio Grande"},
    
    "PARANAGUA": {"id": "BR_PNG", "name": "Paranaguá"},
    "PORTO DE PARANAGUA": {"id": "BR_PNG", "name": "Paranaguá"},
    
    "SAO FRANCISCO DO SUL": {"id": "BR_SFS", "name": "São Francisco do Sul"},
    "PORTO DE SAO FRANCISCO DO SUL": {"id": "BR_SFS", "name": "São Francisco do Sul"},
    
    "ITAJAI": {"id": "BR_ITJ", "name": "Itajaí"},
    "PORTO DE ITAJAI": {"id": "BR_ITJ", "name": "Itajaí"},
    
    "IMBITUBA": {"id": "BR_IMB", "name": "Imbituba"},
    "PORTO DE IMBITUBA": {"id": "BR_IMB", "name": "Imbituba"},
    
    "SANTOS": {"id": "BR_STS", "name": "Santos"},
    "PORTO DE SANTOS": {"id": "BR_STS", "name": "Santos"}
}

def normalize_name(name):
    """Remove acentos e espaços extras para busca no dicionário."""
    import unicodedata
    nfkd_form = unicodedata.normalize('NFKD', name)
    only_ascii = nfkd_form.encode('ASCII', 'ignore')
    return only_ascii.decode('utf-8').upper().strip()

def validate_alternation(records):
    """
    Regra de Ouro: Verifica se há alternância entre HIGH e LOW.
    Retorna (True, None) ou (False, msg_erro)
    """
    if not records:
        return True, None
        
    sorted_records = sorted(records, key=lambda x: datetime.strptime(f"{x['data']} {x['hora']}", "%Y-%m-%d %H:%M"))
    
    last_type = None
    for rec in sorted_records:
        curr_type = rec['tipo_mare'].upper()
        # Normaliza tipo
        if 'BAIXA' in curr_type: curr_type = 'LOW'
        elif 'PREAMAR' in curr_type or 'PREIA' in curr_type: curr_type = 'HIGH'
        else:
            return False, f"Tipo desconhecido: {rec['tipo_mare']}"
            
        if last_type and curr_type == last_type:
            return False, f"Violação da Regra de Ouro em {rec['data']} {rec['hora']}: {curr_type} repetido."
        
        last_type = curr_type
        
    return True, None

def main():
    print("=== FERRAMENTA DE IMPORTAÇÃO DE MARÉS 2026 ===")
    
    input_path = os.path.join(os.getcwd(), INPUT_FILE)
    if not os.path.exists(input_path):
        print(f"❌ Arquivo de entrada '{INPUT_FILE}' não encontrado.")
        print("Crie o arquivo seguindo o modelo: porto,data,hora,altura_m,tipo_mare,fonte")
        return

    # Backup
    if os.path.exists(TARGET_FILE):
        shutil.copy(TARGET_FILE, BACKUP_FILE)
        print(f"✅ Backup criado: {BACKUP_FILE}")
    
    new_records = []
    
    print(f"Lendo {INPUT_FILE}...")
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            # Normalizar cabeçalhos (strip spaces)
            reader.fieldnames = [name.strip() for name in reader.fieldnames]
            
            rows = list(reader)
            print(f"Total de linhas lidas: {len(rows)}")
            
            # Agrupar por porto para validação
            port_groups = {}
            
            for row in rows:
                raw_port = row['porto'].strip()
                norm_port = normalize_name(raw_port)
                
                # Mapeamento
                mapping = PORT_MAPPING.get(norm_port)
                if not mapping:
                    # Tenta match parcial se não achar exato
                    found = False
                    for k, v in PORT_MAPPING.items():
                        if k in norm_port:
                            mapping = v
                            found = True
                            break
                    if not found:
                        print(f"⚠️ Porto desconhecido: '{raw_port}'. Ignorando linha.")
                        continue
                
                station_id = mapping['id']
                station_name = mapping['name']
                
                # Formata Data (Assume YYYY-MM-DD ou DD/MM/YYYY)
                date_str = row['data'].strip()
                if '/' in date_str:
                    d, m, y = date_str.split('/')
                    # Se YYYY for o primeiro, inverte? Não, csv input padrao brasil é DD/MM/YYYY
                    if len(d) == 4: # YYYY/MM/DD
                        date_str = f"{d}/{m}/{y}" # Mantem ou converte? O sistema tides_scraped usa DD/MM/YYYY
                    else:
                        pass # Ja esta DD/MM/YYYY
                else: 
                     # YYYY-MM-DD -> converter para DD/MM/YYYY
                     y, m, d = date_str.split('-')
                     date_str = f"{d}/{m}/{y}"

                record = {
                    'station_id': station_id,
                    'station_name': station_name,
                    'data': date_str, # DD/MM/YYYY
                    'hora': row['hora'].strip(),
                    'height': row['altura_m'].strip(),
                    'tipo_mare': row['tipo_mare'].strip()
                }
                
                if station_id not in port_groups:
                    port_groups[station_id] = []
                port_groups[station_id].append(record)
                new_records.append(f"{station_id},{station_name},{date_str},{row['hora']},{row['altura_m']},{row['tipo_mare']}")

            # Validação
            print("Validando Regra de Ouro...")
            for pid, recs in port_groups.items():
                ok, error = validate_alternation(recs)
                if not ok:
                    print(f"❌ ERRO em {pid}: {error}")
                    print("🚫 Importação ABORTADA para evitar corrupção de dados.")
                    shutil.copy(BACKUP_FILE, TARGET_FILE) # Reverte
                    return
                else:
                    print(f"✅ {pid} ({len(recs)} registros): Validação OK")

    except Exception as e:
        print(f"❌ Erro ao processar arquivo: {e}")
        return

    # Escrever no arquivo alvo (Append ou Overwrite? Append, pois ja pode haver dados de outros portos)
    # Mas cuidado com duplicatas.
    print(f"Adicionando {len(new_records)} registros ao {TARGET_FILE}...")
    
    with open(TARGET_FILE, 'a', encoding='utf-8') as f:
        # Se arquivo vazio, escrever header. Mas asumimos que nao esta vazio.
        for line in new_records:
            f.write(f"\n{line}") # Garante nova linha
            
    print("✅ Importação concluída com SUCESSO!")

if __name__ == "__main__":
    main()
