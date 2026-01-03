import re

def test():
    text = "13:501,3m"
    pattern = re.compile(r'(\d{1,2}:\d{2}).*?([\d.,]+)\s*m')
    matches = pattern.findall(text)
    print(f"Text: {text}")
    print(f"Matches: {matches}")
    
    text2 = "13:50 1.3m"
    matches2 = pattern.findall(text2)
    print(f"Text2: {text2}")
    print(f"Matches2: {matches2}")

if __name__ == "__main__":
    test()
