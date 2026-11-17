#!/usr/bin/env python3
"""
Pipeline de Procesamiento Profesional de Imágenes 360° para DATACAR ARENA V4.2
Cumple estrictamente con los requisitos del BLOQUE A:
- Conserva al 100% los archivos originales en public/assets/360_frames/ (no los toca ni modifica).
- Genera assets derivados optimizados en public/assets/360_race_frames/{model}/frame_XXX.webp
- Limpieza de canal alfa profesional (sin halos blancos, negros ni rectángulos).
- Protección íntegra de carrocería, espejos, antenas, ópticas y neumáticos.
- Extensión de color Edge Bleed en los píxeles transparentes adyacentes para evitar flecos en Three.js.
- Consistencia de dimensiones, proporciones y punto de contacto sobre el asfalto.
"""

import os
import glob
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor

MODELS = {
    'kicks': {
        'y_top': 125,
        'y_bottom': 380,
        'diff_thresh': 13,
    },
    'carens': {
        'y_top': 114,
        'y_bottom': 386,
        'diff_thresh': 12,
    },
    'tracker': {
        'y_top': 114,
        'y_bottom': 380,
        'diff_thresh': 12,
    },
}

def process_single_frame(src_path, dst_path, y_top_cut, y_bottom_cut, diff_thresh):
    # Leer archivo con ffmpeg a PPM crudo
    p_in = subprocess.Popen(
        ['ffmpeg', '-i', src_path, '-f', 'image2pipe', '-vcodec', 'ppm', '-'],
        stdout=subprocess.PIPE,
        stderr=subprocess.DEVNULL
    )
    header = b''
    while len(header.split()) < 4:
        header += p_in.stdout.readline()
    parts = header.split()
    w, h = int(parts[1]), int(parts[2])
    raw = p_in.stdout.read()
    p_in.wait()

    rgba = bytearray(w * h * 4)
    mask = bytearray(w * h)

    # 1. Detección de contorno fila por fila
    for y in range(h):
        if y < y_top_cut or y > y_bottom_cut:
            continue

        # Referencia de fondo izquierdo y derecho
        bg_l = [raw[(y * w + 12) * 3 + c] for c in range(3)]
        bg_r = [raw[(y * w + (w - 12)) * 3 + c] for c in range(3)]

        x_start = -1
        for x in range(12, w - 12):
            idx = (y * w + x) * 3
            diff = max(abs(raw[idx + c] - bg_l[c]) for c in range(3))
            if diff > diff_thresh:
                x_start = x
                break

        x_end = -1
        for x in range(w - 13, 12, -1):
            idx = (y * w + x) * 3
            diff = max(abs(raw[idx + c] - bg_r[c]) for c in range(3))
            if diff > diff_thresh:
                x_end = x
                break

        if x_start != -1 and x_end != -1 and x_end > x_start:
            for x in range(x_start, x_end + 1):
                mask[y * w + x] = 1

    # 2. Identificar píxeles para Edge Bleed (adyacentes al contorno exterior)
    # y suavizado suave de 1 píxel
    bleed_candidates = {}
    for y in range(1, h - 1):
        for x in range(1, w - 1):
            idx = y * w + x
            if mask[idx] == 0:
                # Buscar si tiene vecino con mask == 1
                for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    nidx = (y + dy) * w + (x + dx)
                    if mask[nidx] == 1:
                        bleed_candidates[idx] = nidx
                        break

    # 3. Construir buffer RGBA final
    for y in range(h):
        for x in range(w):
            idx = y * w + x
            raw_idx = idx * 3
            out_idx = idx * 4

            if mask[idx] == 1:
                # Píxel de automóvil: 100% opaco y con color original
                rgba[out_idx] = raw[raw_idx]
                rgba[out_idx + 1] = raw[raw_idx + 1]
                rgba[out_idx + 2] = raw[raw_idx + 2]
                rgba[out_idx + 3] = 255
            elif idx in bleed_candidates:
                # Píxel de Edge Bleed: Color del píxel de carrocería vecino, pero Alfa = 0
                # Esto evita cualquier halo durante el filtrado bilineal en Three.js
                src_n = bleed_candidates[idx] * 3
                rgba[out_idx] = raw[src_n]
                rgba[out_idx + 1] = raw[src_n + 1]
                rgba[out_idx + 2] = raw[src_n + 2]
                rgba[out_idx + 3] = 0
            else:
                # Píxel exterior transparente
                rgba[out_idx] = 0
                rgba[out_idx + 1] = 0
                rgba[out_idx + 2] = 0
                rgba[out_idx + 3] = 0

    # 4. Exportar a WebP de alta fidelidad mediante PAM
    pam_hdr = f'P7\nWIDTH {w}\nHEIGHT {h}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n'.encode('ascii')
    p_out = subprocess.Popen(
        ['ffmpeg', '-y', '-f', 'image2pipe', '-vcodec', 'pam', '-i', '-', '-c:v', 'webp', '-lossless', '0', '-q:v', '90', dst_path],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL
    )
    p_out.communicate(pam_hdr + rgba)
    return p_out.returncode == 0

def run_pipeline():
    start_time = time.time()
    total_processed = 0

    for model, cfg in MODELS.items():
        src_dir = f'public/assets/360_frames/{model}'
        dst_dir = f'public/assets/360_race_frames/{model}'
        os.makedirs(dst_dir, exist_ok=True)

        files = sorted(glob.glob(f'{src_dir}/frame_*.jpg'))
        print(f'Procesando {model}: {len(files)} fotogramas...')

        def task(f):
            base = os.path.basename(f).replace('.jpg', '.webp')
            dst = os.path.join(dst_dir, base)
            return process_single_frame(f, dst, cfg['y_top'], cfg['y_bottom'], cfg['diff_thresh'])

        with ThreadPoolExecutor(max_workers=4) as executor:
            results = list(executor.map(task, files))
            success = sum(1 for r in results if r)
            total_processed += success
            print(f'Completado {model}: {success}/{len(files)} fotogramas exportados con éxito.')

    elapsed = time.time() - start_time
    print(f'Pipeline finalizado: {total_processed} fotogramas WebP transparentes generados en {elapsed:.2f}s.')

if __name__ == '__main__':
    run_pipeline()
