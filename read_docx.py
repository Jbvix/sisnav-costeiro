
import zipfile
import xml.etree.ElementTree as ET
import sys
import os

def extract_text_from_docx(docx_path):
    if not os.path.exists(docx_path):
        print(f"File not found: {docx_path}")
        return

    try:
        with zipfile.ZipFile(docx_path) as zf:
            xml_content = zf.read('word/document.xml')
            tree = ET.fromstring(xml_content)
            
            # XML namespace for Word
            namespaces = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            
            text_lines = []

            # Iterate through body elements (paragraphs and tables)
            # We need to preserve order, so we iterate through child nodes of body
            body = tree.find('w:body', namespaces)
            if body is None:
                print("No body found")
                return

            for element in body:
                tag = element.tag
                # Paragraphs
                if tag.endswith('p'):
                    texts = [node.text for node in element.findall('.//w:t', namespaces) if node.text]
                    if texts:
                        text_lines.append(''.join(texts))
                # Tables
                elif tag.endswith('tbl'):
                    text_lines.append("\n--- TABLE START ---")
                    for row in element.findall('.//w:tr', namespaces):
                        row_cells = []
                        for cell in row.findall('.//w:tc', namespaces):
                            cell_texts = [node.text for node in cell.findall('.//w:t', namespaces) if node.text]
                            row_cells.append("".join(cell_texts))
                        text_lines.append(" | ".join(row_cells))
                    text_lines.append("--- TABLE END ---\n")
                    
            print("\n".join(text_lines))
            
    except Exception as e:
        print(f"Error reading docx: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python read_docx.py <filename>")
    else:
        extract_text_from_docx(sys.argv[1])
