import sys
import os

# Adiciona o diretório atual ao path do Python
sys.path.append(os.getcwd())

# Importa a aplicação principal do arquivo server.py
# NUNCA defina rotas aqui. Defina tudo em server.py
from server import app as application
