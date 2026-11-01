import sys
import os

try:
    from pypdf import PdfReader
    print("Using pypdf")
    
    def read_pdf(path):
        reader = PdfReader(path)
        text = ""
        for page in reader.pages:
            text += page.extract_text() + "\n"
        return text

except ImportError:
    print("pypdf not found.")
    # Try basic strings extraction (very rough) if needed, or just fail
    # sys.exit(1)
    
    # Minimal fallback for text extraction if strings cmd was available (it's not windows default)
    # We will try to just open as latin-1 and look for text-like chunks (terrible but better than nothing)
    def read_pdf(path):
        print("Attempting raw read (unreliable)...")
        with open(path, 'rb') as f:
            content = f.read()
            # This is binary, mostly useless for PDF, but might show headers.
            return "Please install pypdf to read this file properly."

if __name__ == "__main__":
    target = r"C:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\planodeviagem.pdf"
    if os.path.exists(target):
        try:
            full_text = read_pdf(target)
            print(full_text[:5000]) # First 5000 chars should cover the requirements list
        except Exception as e:
            print(f"Error: {e}")
    else:
        print("File not found")
