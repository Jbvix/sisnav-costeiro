import sys
import os

# CONFIGURAÇÃO DE DEPLOY - SISNAV COSTEIRO
# Adiciona o diretório atual ao path para encontrar o server.py
project_home = os.getcwd()
if project_home not in sys.path:
    sys.path = [project_home] + sys.path

# Importa a aplicação Flask do arquivo server.py
from server import app as application
