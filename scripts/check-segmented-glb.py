"""Inspecciona sin dependencias la estructura del GLB segmentado para DATACAR."""
import json
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'public' / 'models' / 'tracker-rs-wheels.glb'
with path.open('rb') as f:
    header = f.read(20)
    magic, version, file_length, json_size, chunk_type = struct.unpack('<4sIIII', header)
    if magic != b'glTF' or version != 2 or chunk_type != 0x4E4F534A:
        raise ValueError('No es un GLB 2.0 válido')
    gltf = json.loads(f.read(json_size))

print(f'Archivo: {path.name} ({file_length / 1e6:.1f} MB)')
print(f'Mallas: {len(gltf.get("meshes", []))}; nodos: {len(gltf.get("nodes", []))}')
parts = []
for node in gltf['nodes']:
    if not node.get('name', '').startswith('model_part') or 'mesh' not in node:
        continue
    prim = gltf['meshes'][node['mesh']]['primitives'][0]
    acc = gltf['accessors'][prim['attributes']['POSITION']]
    mn, mx = acc['min'], acc['max']
    center = tuple((a+b)/2 for a,b in zip(mn,mx))
    size = tuple(b-a for a,b in zip(mn,mx))
    print(node['name'], 'centro', tuple(round(c,5) for c in center), 'tamaño', tuple(round(s,5) for s in size))
    parts.append((node['name'], center, size))
assert len(parts) == 5, 'Se esperaban 5 piezas (carrocería y 4 ruedas)'
wheels = [p for p in parts if p[0] != 'model_part0']
assert len(wheels) == 4 and len({(round(w[1][0],3), round(w[1][2],3)) for w in wheels}) == 4
print('OK: cuatro piezas de rueda ubicadas en las cuatro esquinas del vehículo.')
