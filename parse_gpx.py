
import xml.etree.ElementTree as ET
import sys
import os
import json

def parse_gpx(file_path):
    if not os.path.exists(file_path):
        print(f"File not found: {file_path}")
        return None

    try:
        tree = ET.parse(file_path)
        root = tree.getroot()
        
        # GPX Namespace handling
        # Usually {http://www.topografix.com/GPX/1/1}
        ns = {'gpx': 'http://www.topografix.com/GPX/1/1'}
        
        # Try to find namespace if strict matching fails
        if not root.tag.startswith('{http'):
             # No namespace or different version
             ns = {} 
             prefix = ""
        else:
             prefix = "gpx:"

        route_points = []
        
        # 1. Look for <rte> (Routes)
        routes = root.findall(f'.//{prefix}rte', ns)
        for rte in routes:
            for pt in rte.findall(f'{prefix}rtept', ns):
                lat = float(pt.get('lat'))
                lon = float(pt.get('lon'))
                name_el = pt.find(f'{prefix}name', ns)
                name = name_el.text if name_el is not None else f"WPT {len(route_points)+1}"
                
                route_points.append({
                    "sequence": len(route_points) + 1,
                    "lat_dec": lat,
                    "lon_dec": lon,
                    "lat_raw": f"{abs(lat):.4f} {'N' if lat>=0 else 'S'}", # Mock raw for consistency
                    "lon_raw": f"{abs(lon):.4f} {'E' if lon>=0 else 'W'}",
                    "name": name,
                    "chart": "" # GPX usually doesn't have chart info
                })

        # 2. Look for <trk> (Tracks) if no route found
        if not route_points:
             tracks = root.findall(f'.//{prefix}trk', ns)
             for trk in tracks:
                 for trkseg in trk.findall(f'{prefix}trkseg', ns):
                     for pt in trkseg.findall(f'{prefix}trkpt', ns):
                        lat = float(pt.get('lat'))
                        lon = float(pt.get('lon'))
                        # Track points might be too many, but let's take them all for now
                        route_points.append({
                            "sequence": len(route_points) + 1,
                            "lat_dec": lat,
                            "lon_dec": lon,
                            "lat_raw": f"{lat:.4f}",
                            "lon_raw": f"{lon:.4f}",
                            "name": f"TRK {len(route_points)+1}",
                            "chart": ""
                        })

        output = {
            "source_type": "GPX",
            "metadata": {
                "filename": os.path.basename(file_path)
            },
            "route": route_points
        }
        
        return output

    except Exception as e:
        print(f"Error parsing GPX: {e}")
        return None

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python parse_gpx.py <path_to_gpx>")
        sys.exit(1)
        
    result = parse_gpx(sys.argv[1])
    if result:
        print(json.dumps(result, indent=2, ensure_ascii=False))
