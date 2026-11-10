"""Reduce las texturas PNG del GLB Meshy manteniendo intactos mallas, UV y nodos.

Uso (por defecto):
  python scripts/optimize_segmented_glb.py original.glb public/models/tracker-rs-wheels.glb

No simplifica triángulos; reduce VRAM, tiempo de descarga y tiempo de decodificación.
"""
import io
import json
import struct
import sys
from pathlib import Path
from PIL import Image


def optimize(source: Path, destination: Path):
    data = source.read_bytes()
    magic, version, nbytes = struct.unpack_from('<4sII', data, 0)
    assert magic == b'glTF' and version == 2 and nbytes == len(data)
    json_length, json_type = struct.unpack_from('<II', data, 12)
    assert json_type == 0x4E4F534A
    gltf = json.loads(data[20:20+json_length])
    bin_header_offset = 20 + json_length
    bin_length, bin_type = struct.unpack_from('<II', data, bin_header_offset)
    assert bin_type == 0x004E4942
    binary = data[bin_header_offset+8:bin_header_offset+8+bin_length]
    # Image 0: metallic-roughness 2048 -> 1024, images 1/2: diffuse/normal 4096 -> 2048.
    limits = {0: 1024, 1: 2048, 2: 2048}
    image_blobs = {}
    for idx, image in enumerate(gltf['images']):
        view = gltf['bufferViews'][image['bufferView']]
        start = view.get('byteOffset', 0)
        blob = binary[start:start+view['byteLength']]
        picture = Image.open(io.BytesIO(blob))
        maxsize = limits.get(idx, 2048)
        if max(picture.size) > maxsize:
            picture.thumbnail((maxsize, maxsize), Image.Resampling.LANCZOS)
            output = io.BytesIO()
            picture.save(output, 'PNG', optimize=True, compress_level=6)
            blob = output.getvalue()
        image_blobs[image['bufferView']] = blob
        print(f"Textura {idx}: {picture.size}, PNG {len(blob)/1e6:.2f} MB")

    new_binary = bytearray()
    for idx, view in enumerate(gltf['bufferViews']):
        pad = (-len(new_binary)) % 4
        if pad: new_binary.extend(b'\0'*pad)
        offset = view.get('byteOffset', 0)
        blob = image_blobs.get(idx, binary[offset:offset+view['byteLength']])
        view['byteOffset'] = len(new_binary)
        view['byteLength'] = len(blob)
        new_binary.extend(blob)
    while len(new_binary) % 4:
        new_binary.append(0)
    gltf['buffers'][0]['byteLength'] = len(new_binary)
    new_json = json.dumps(gltf, separators=(',',':'), ensure_ascii=False).encode('utf8')
    new_json += b' ' * ((-len(new_json)) % 4)
    result_len = 12 + 8+len(new_json) + 8+len(new_binary)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with destination.open('wb') as f:
        f.write(struct.pack('<4sII', b'glTF', 2, result_len))
        f.write(struct.pack('<II',len(new_json),0x4E4F534A))
        f.write(new_json)
        f.write(struct.pack('<II',len(new_binary),0x004E4942))
        f.write(new_binary)
    print(f"GLB original {len(data)/1e6:.1f} MB -> optimizado {result_len/1e6:.1f} MB (UV, geometrías y nombres preservados)")


if __name__ == '__main__':
    src = Path(sys.argv[1])
    dst = Path(sys.argv[2])
    if src.resolve() == dst.resolve():
        raise ValueError('Proporcione un destino diferente para preservar el original.')
    optimize(src,dst)
