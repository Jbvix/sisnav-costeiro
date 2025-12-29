import sys
import os

# 1. Obter o diretório ONDE este script está rodando
project_home = u'/home/SEU_USUARIO/public_html/sisnav' # Exemplo genérico, melhor usar dinâmico
if 'HOME' in os.environ:
    # Tenta inferir o path real
    project_home = os.getcwd()

# 2. Adicionar ao Path do Python
if project_home not in sys.path:
    sys.path = [project_home] + sys.path

# 3. Debug (Opcional - grava num arquivo para sabermos se rodou)
# with open("passenger_log.txt", "a") as f:
#     f.write(f"Iniciando em: {project_home}\n")

# 4. Importar o app FLASK
from server import app as application
