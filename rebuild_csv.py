# =============================================================================
# SISNAV Costeiro — Sistema de Auxílio à Navegação
# Copyright (c) 2025 Jossian Brito (TugLife). Todos os direitos reservados.
# Autor: Jossian Brito | Contato: jossiancosta@gmail.com
# Este software é proprietário e confidencial. O uso não autorizado é proibido.
# =============================================================================

import pandas as pd
import glob
import os

def rebuild_master_csv():
    # Agrega todos os CSVs de maré em um único master para busca rápida
    files = glob.glob('data/tides/*.csv')
    df_list = []
    for f in files:
        temp_df = pd.read_csv(f)
        df_list.append(temp_df)
    
    master_df = pd.concat(df_list)
    master_df.to_csv('data/tides_master.csv', index=False)

if __name__ == '__main__':
    rebuild_master_csv()
