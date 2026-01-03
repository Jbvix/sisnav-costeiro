import csv
from datetime import datetime

tide_file = 'tides_scraped.csv'
weather_file = 'weather_scraped.csv'

def check_csv(filename):
    print(f"--- Inspecting {filename} ---")
    stations = set()
    dates = []
    
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            for row in reader:
                if len(row) < 3: continue
                # Layout: id, name, date, ...
                name = row[1].strip()
                date_str = row[2].strip()
                
                stations.add(name)
                try:
                    dates.append(datetime.strptime(date_str, '%d/%m/%Y'))
                except:
                    pass
        
        print(f"Unique Stations ({len(stations)}):")
        for s in sorted(stations):
            print(f" - {s}")
            
        if dates:
            print(f"\nDate Range: {min(dates)} to {max(dates)}")
            
        # Check specific stations
        print("\nChecking Specifics:")
        for target in ["Rio de Janeiro", "Rio Grande"]:
            if target in stations:
                print(f"Found '{target}'.")
            else:
                print(f"MISSING '{target}'!")

    except Exception as e:
        print(f"Error reading {filename}: {e}")

check_csv(tide_file)
check_csv(weather_file)
