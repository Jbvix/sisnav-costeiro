
import PyPDF2
import re

pdf_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\Lista_Farois.pdf'
txt_path = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\LIGHTHOUSES.txt'

def normalize(text):
    return text.lower().strip()

def check_pdf():
    try:
        reader = PyPDF2.PdfReader(pdf_path)
        print(f"Reading PDF with {len(reader.pages)} pages...")
        
        full_text = ""
        for page in reader.pages:
            full_text += page.extract_text() + "\n"
            
        # Check for specific Maricá entry
        if "Ilhas Maricá" in full_text or "Ilhas Marica" in full_text:
            print("Found 'Ilhas Maricá' in PDF.")
            
            # Try to grab context
            lines = full_text.split('\n')
            for i, line in enumerate(lines):
                if "Ilhas Maricá" in line or "Ilhas Marica" in line:
                    print(f"Context Line {i}: {line.strip()}")
                    # Print subsequent lines for description?
                    for j in range(1, 4):
                        if i+j < len(lines):
                            print(f"Context Line {i+j}: {lines[i+j].strip()}")
                            
        else:
            print("'Ilhas Maricá' NOT found in PDF text.")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_pdf()
