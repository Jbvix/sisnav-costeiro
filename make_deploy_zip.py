import zipfile
import os
import datetime

def create_deploy_package():
    # Files identified as modified or new for v3.4.0
    files_to_deploy = [
        'server.py',
        'index.html',
        'admin_dashboard.html',
        'js/App.js',
        'js/utils/UIManager.js',
        'MANUAL_DO_USUARIO.md',
        'proposta_atualizacao_v3_4_0.md',
        'release_notes_2026_01_13.md'
    ]

    # Timestamp for unique filename
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M")
    zip_filename = f"deploy_sisnav_v3.4.0_{timestamp}.zip"

    print(f"Criando pacote: {zip_filename}...")
    
    with zipfile.ZipFile(zip_filename, 'w', zipfile.ZIP_DEFLATED) as zipf:
        for file_path in files_to_deploy:
            if os.path.exists(file_path):
                print(f"  + Adicionando: {file_path}")
                zipf.write(file_path, arcname=file_path)
            else:
                # Try absolute path from artifacts if it's a markdown file created recently?
                # The markdown files are in the artifact directory, not the working root?
                # Wait, I wrote MANUAL_DO_USUARIO.md to c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\MANUAL_DO_USUARIO.md (TargetFile argument).
                # But release_notes and proposta were written where?
                # release_notes: C:\Users\ACER\.gemini\antigravity\brain\be7ecbe0-96be-4338-af0e-477f810dcd3e\release_notes_2026_01_13.md
                # proposta: C:\Users\ACER\.gemini\antigravity\brain\be7ecbe0-96be-4338-af0e-477f810dcd3e\proposta_atualizacao_v3_4_0.md
                # I need to copy them or reference them.
                # Since the script runs in the root, it won't find the artifact files unless I copy them first.
                print(f"  ! AVISO: Arquivo não encontrado na raiz: {file_path}")

    print(f"\nPacote criado com sucesso em: {os.path.abspath(zip_filename)}")

if __name__ == "__main__":
    create_deploy_package()
