
path_pdf = r'c:\Users\ACER\Documents\PROGRAMAS\Relatório de Viagem Costeira\sisnav costeiro\library\Lista_Farois.pdf'

def try_read():
    try:
        import PyPDF2
        print("PyPDF2 is available.")
        reader = PyPDF2.PdfReader(path_pdf)
        print(f"Pages: {len(reader.pages)}")
        
        # Search for Ilhas Maricá
        found = False
        for i in range(len(reader.pages)):
            text = reader.pages[i].extract_text()
            if "Ilhas Maricá" in text or "Ilhas Marica" in text:
                print(f"Found on page {i+1}:")
                # Print context
                lines = text.split('\n')
                for line in lines:
                    if "Ilhas Maricá" in line or "Ilhas Marica" in line:
                        print(line)
                found = True
                break
        
        if not found:
            print("Not found in text (might be image-based PDF).")

    except ImportError:
        print("PyPDF2 not installed.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    try_read()
