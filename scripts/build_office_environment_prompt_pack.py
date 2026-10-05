"""Build a reference-backed GPT web prompt pack; never generate runtime artwork.

Reference PNGs are copied byte-for-byte. The two diagrams are technical guides,
not generated illustrations or screenshots. Existing Office source is read-only.
"""
from pathlib import Path
import csv
import hashlib
import html
import json
import shutil
import zipfile
from collections import Counter
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT.parent.parent / 'office-environment-prompts-20261005'
ARCH = ROOT / 'art/dot-z08-components-2026-10-05/sources/Z08-04-architecture-components/architecture'
LEDGER = ROOT / 'art/environment-foundation-2026-10-05'
SOURCE_MAP = ROOT / 'frontend/public/maps/floor1.tmj'
SOURCE_SHA = hashlib.sha256(SOURCE_MAP.read_bytes()).hexdigest()
GUIDE = '01-geometri-2-to-1.png'
CONTEXT = '00-suasana-z08.png'
FLOOR = '02-oak-reference.png'
TALL = {'R': '03-wall-tall-R-reference.png', 'L': '04-wall-tall-L-reference.png'}
LOW = {'R': '05-wall-low-R-reference.png', 'L': '06-wall-low-L-reference.png'}
DOOR = '07-doorframe-reference.png'
PILLAR = '08-pillar-reference.png'
SPEC = []


def add(code, group, title, slug, subject, refs, geometry, required=True):
    SPEC.append(dict(code=code, group=group, title=title, outputFile=f'{code}-{slug}.png',
                     subject=subject, referenceFiles=[GUIDE, *refs], geometry=geometry,
                     required=required, status='needs_web_generation', nativeCanvas='1024x1024 requested; verify actual returned size',
                     projection='orthographic 2:1 dimetric', exportScale=2))


floor_geo = dict(footprintTiles=[1, 1], logicalDiamond=[64, 32], packedDiamondPx=[128, 64], thickness=0)
add('F01', '01-lantai', 'Lantai oak utama', 'floor-oak-a',
    'One seamless single-tile honey/light-oak floor diamond. Fine quiet wood grain and staggered plank joints running along R. No perimeter outline, slab sides or edge bevel; a flat surface that can repeat across a whole office. Match opposite edges for a continuous plank pattern.', [FLOOR], floor_geo)
add('F02', '01-lantai', 'Variasi lantai oak', 'floor-oak-b',
    'One alternate honey/light-oak single-tile floor diamond. Keep exactly the same shade, plank width, direction and edge pattern as F01. Change only quiet interior grain; no stain, unique knot landmark or decorative motif. This is a same-material variation, not another room theme.', [FLOOR], floor_geo)
add('F03', '01-lantai', 'Lantai koridor abu-abu', 'floor-corridor-gray',
    'One seamless single-tile warm charcoal-gray matte stone/ceramic floor diamond. Subtle thin grout, low contrast, clean modern office material. No wood grain, logos, arrows, tile-border outline or slab sides. Repeatable edges; avoid a checkerboard contrast when tiled.', [TALL['R'], FLOOR], floor_geo)
add('F04', '01-lantai', 'Lantai outdoor antiselip', 'floor-outdoor-stone',
    'One seamless single-tile light blue-gray matte stone pool-deck floor diamond. Restrained fine non-slip texture, dry surface, no cracks or vegetation. Same outline/shading language as the office references. No coping, water, furniture, rim outline or slab sides.', [TALL['R'], FLOOR], floor_geo)
for code, axis in [('F05', 'R'), ('F06', 'L')]:
    add(code, '01-lantai', f'Tepi platform {axis}', f'platform-edge-{axis.lower()}',
        f'One exposed front slab edge along {axis}, length one grid edge. Thin blue-gray structural fascia below ground level, depth four logical pixels. No top floor surface or wall. Modular end faces, subtle underside shading entirely within the object. This attaches below the floor perimeter, not on every floor tile.', [TALL[axis]], dict(axis=axis, lengthTiles=1, belowFloorDepth=4))
add('F07', '01-lantai', 'Sudut depan platform', 'platform-corner-s',
    'One south/front outside corner joining two exposed platform fascia strips. Ground endpoint S is the closest diamond vertex; legs run from S toward screen upper-left and upper-right, each one grid edge. Depth four logical pixels below ground. No top floor panel, wall, pedestal or furniture.', [TALL['R'], TALL['L']], dict(corner='S', legsTiles=[1, 1], belowFloorDepth=4))

for idx, (height, length, axis) in enumerate([(80,1,'R'),(80,1,'L'),(80,2,'R'),(80,2,'L'),(16,1,'R'),(16,1,'L'),(16,2,'R'),(16,2,'L')], 1):
    kind = 'tall' if height == 80 else 'low'
    add(f'W{idx:02}', '02-dinding', f'Dinding {"tinggi" if height == 80 else "rendah"} {axis}, {length} modul', f'wall-{kind}-{axis.lower()}-{length}u',
        f'One straight {kind} blue-gray office wall along {axis}, exactly {length} grid-edge module(s) long. Height {height} logical pixels, thickness six logical floor-plane units. Matte panels, charcoal skirting and restrained top cap. Both ends are flush and complete so segments join without an overhang; no pillar, floor or neon strip. Panel rhythm is one subtle seam per grid module, never a large dark border at each seam.', [(TALL if height == 80 else LOW)[axis]], dict(axis=axis, lengthTiles=length, height=height, thickness=6))
add('W09', '02-dinding', 'Sudut belakang dinding tinggi', 'wall-corner-n-tall',
    'One north/back interior wall corner: a central rear diamond vertex N with two tall wall legs extending toward screen lower-right (+R) and lower-left (+L). Each leg is one grid edge, height 80, thickness six logical units. Joined top caps and skirting are seamless. The inner faces are visible. No floor, pillar, doorway or decorations.', [TALL['R'], TALL['L']], dict(corner='N', legsTiles=[1,1], height=80, thickness=6))
add('W10', '02-dinding', 'Sudut depan dinding rendah', 'wall-corner-s-low',
    'One south/front outside cutaway-wall corner: a central nearest diamond vertex S with low wall legs extending toward screen upper-left (-R) and upper-right (-L). Each leg is one grid edge, height 16, thickness six logical units. The outside faces are visible; top caps and skirting join cleanly. No floor, tall post, fence, doorway or decoration.', [LOW['R'], LOW['L']], dict(corner='S', legsTiles=[1,1], height=16, thickness=6))
add('P01', '03-pilar', 'Pilar sambungan tinggi', 'pillar-tall',
    'One slim full-height charcoal/blue-gray structural junction pillar. Square footprint six by six logical floor units, height 80. Two visible faces and a dimetric top cap. One narrow restrained cyan inset on the visible darker face, matching the reference, without glow spilling outside alpha. It covers wall joins/end terminals; no pedestal wider than its footprint.', [PILLAR], dict(footprintLogical=[6,6], height=80))
add('P02', '03-pilar', 'Post sambungan rendah', 'post-low',
    'One low blue-gray corner/end post for cutaway wall joins. Square footprint six by six logical units, height 16, same cap and skirting as low wall. No tall pillar, glowing lamp, separate base or floor. It must join W05/W06 at equal cap height.', [PILLAR, LOW['R']], dict(footprintLogical=[6,6], height=16))
for idx, (kind, axis, height) in enumerate([('open','R',80),('open','L',80),('cutaway','R',16),('cutaway','L',16),('entrance','R',80),('entrance','L',80)], 1):
    body = ('Two low jamb terminals only; no overhead beam, arch or door leaf. Keep the passage open at floor level.' if kind == 'cutaway' else
            'Two slim jambs and one lintel; clear opening height 72 logical pixels. No door leaf, glass across the opening, sill step or floor patch.')
    accent = 'A restrained narrow cyan inset on one jamb, same charcoal hardware as the reference.' if kind != 'cutaway' else 'Same blue-gray material and skirting as low cutaway walls; no cyan tower.'
    add(f'D{idx:02}', '04-pintu', f'{"Kusen depan rendah" if kind == "cutaway" else "Kusen entrance" if kind == "entrance" else "Kusen terbuka"} {axis}', f'door-{kind}-{axis.lower()}',
        f'One isolated {kind} office passage frame along {axis}. Total ground span one grid edge, thickness six logical units, total height {height}. Each jamb takes four logical units along the span; unobstructed clear width is 24 logical units. {body} {accent} Ends join adjoining wall modules. A true transparent passage, never filled with a black rectangle or another room scene.', [DOOR, LOW[axis] if height==16 else TALL[axis]], dict(axis=axis, lengthTiles=1, height=height, thickness=6, clearWidth=24, clearHeight=72 if height==80 else None))
for idx, (kind, axis) in enumerate([('window','R'),('window','L'),('partition','R'),('partition','L')], 1):
    desc = ('A blue-gray tall-wall window bay with a centered clean rectangular opening, charcoal frame and pale cyan lightly tinted glass. Solid wall below/above the aperture matches the tall walls. No view painted behind the glass.' if kind == 'window' else
            'A floor-to-top minimalist interior glass partition panel, thin charcoal frame and pale cyan lightly tinted glass. No door, opaque drywall infill or furniture; this is an optional future structural variant, not a new room layout.')
    add(f'G{idx:02}', '05-jendela-kaca', f'{"Jendela" if kind=="window" else "Partisi kaca opsional"} {axis}', f'{kind}-{axis.lower()}',
        f'One isolated {kind} module along {axis}, ground length one grid edge, total height 80 and wall/frame thickness six logical units. {desc} Reflections are quiet and consistent with upper-left light. Glass uses genuine partial alpha; transparent margins and openings must not contain a checkerboard, landscape or fake transparency. No frosted labels, screens or UI.', [TALL[axis], DOOR], dict(axis=axis, lengthTiles=1, height=80, thickness=6), required=kind=='window')
for code, axis in [('J01','R'),('J02','L')]:
    add(code, '06-transisi', f'Ambang lantai {axis}', f'threshold-{axis.lower()}',
        f'One flush ground-level charcoal metal threshold strip running along {axis}. Length one grid edge; narrow three-logical-unit footprint across the strip, height zero (no step). Clean seam between oak and gray floor, no adjoining floor tiles, doorway, screw text, carpet or decoration. It must not make a walkable opening look blocked.', [DOOR, FLOOR], dict(axis=axis, lengthTiles=1, width=3, height=0))
add('O01', '07-outdoor-kolam', 'Permukaan air kolam', 'pool-water',
    'One seamless single-tile still pool-water diamond, muted clear cyan/teal with very gentle small ripples and soft restrained light. Water inside the diamond is opaque so unrelated underlying floor does not show through. No pool rim, rectangular pool scene, swimmers, ladder, floating objects, sunlight sparkle stars or slab sides. Repeatable edges; no perimeter outline.', [CONTEXT, TALL['R']], floor_geo)
for code, axis in [('O02','R'),('O03','L')]:
    add(code, '07-outdoor-kolam', f'Bibir kolam {axis}', f'pool-coping-{axis.lower()}',
        f'One straight matte blue-gray stone pool coping/rim segment along {axis}, length one grid edge. Band width eight logical units, top flush with outdoor deck level; a short four-logical-pixel inner lip is visible below the water-facing edge. No surrounding deck or water plane. Flush modular ends, quiet contour and texture; no lounger, ladder or plant.', [TALL[axis], FLOOR], dict(axis=axis, lengthTiles=1, width=8, innerLipDepth=4, waterSide='toward pool interior at assembly'))
for idx, corner in enumerate(['N','S','E','W'], 4):
    legs = {'N':'lower-right (+R) and lower-left (+L)', 'S':'upper-left (-R) and upper-right (-L)', 'E':'upper-left (-R) and lower-left (+L)', 'W':'lower-right (+R) and upper-right (-L)'}[corner]
    add(f'O{idx:02}', '07-outdoor-kolam', f'Sudut bibir kolam {corner}', f'pool-coping-corner-{corner.lower()}',
        f'One {corner} corner pool coping module connecting two perpendicular rim runs. Vertex {corner} has one-grid-edge legs going screen {legs}. Match straight coping: blue-gray matte stone, band width eight logical units, top flush with deck, inner lip depth four. The lip faces the interior of the diamond pool, never the outdoor deck. No water plane, complete pool, floor surface, ladder or furniture.', [TALL['R'], TALL['L']], dict(corner=corner, legsTiles=[1,1], width=8, innerLipDepth=4))


def dump(path, value):
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False)+'\n', encoding='utf-8', newline='\n')


def font(size, bold=False):
    return ImageFont.truetype('C:/Windows/Fonts/'+('arialbd.ttf' if bold else 'arial.ttf'), size)


def diagram():
    im=Image.new('RGB',(1600,1000),'#f3f5f8');d=ImageDraw.Draw(im)
    d.text((55,35),'GEOMETRI 2:1 — BUKAN REFERENSI WARNA / GAMBAR ASET',font=font(35,True),fill='#172232')
    d.text((55,90),'Dimetric orthographic. Satu tile logical 64 x 32; ukuran gambar export 2x.',font=font(24),fill='#44556a')
    n=(450,235);r=(750,385);s=(450,535);l=(150,385)
    d.polygon([n,r,s,l],fill='#dce5ec',outline='#243d58',width=4)
    for name,p in zip(['N','E','S','W'],[n,r,s,l]):d.text((p[0]+10,p[1]-35),name,font=font(28,True),fill='#172232')
    d.line([n,r],fill='#c25f3a',width=7);d.line([n,l],fill='#087e95',width=7)
    d.text((565,255),'R = +gx',font=font(26,True),fill='#b04d2a')
    d.text((550,292),'screen (+32, +16)',font=font(22),fill='#b04d2a')
    d.text((180,255),'L = +gy',font=font(26,True),fill='#087e95')
    d.text((130,292),'screen (-32, +16)',font=font(22),fill='#087e95')
    d.text((175,580),'Lebar 64 logical / 128 packed px',font=font(24),fill='#172232')
    d.text((175,620),'Tinggi 32 logical / 64 packed px',font=font(24),fill='#172232')
    a=(1070,650);b=(1262,746);h=480
    d.polygon([a,b,(b[0],b[1]-h),(a[0],a[1]-h)],fill='#dce5ec',outline='#243d58',width=4)
    d.line([a,b],fill='#c25f3a',width=7)
    d.text((960,100),'Dinding R: baseline miring +1/2',font=font(27,True),fill='#172232')
    d.text((970,775),'Tinggi naik vertikal di layar.',font=font(23),fill='#172232')
    d.text((970,812),'Tinggi penuh 80 / rendah 16 logical.',font=font(23),fill='#172232')
    d.text((55,890),'Pertahankan sudut, jangan mirror gambar jadi: cahaya tetap kiri atas.',font=font(26,True),fill='#172232')
    d.text((55,935),'Canvas native besar boleh. Padding transparan bukan ukuran footprint; ukuran final dikalibrasi saat packing.',font=font(22),fill='#44556a')
    im.save(OUT/'references'/GUIDE)


def plan(map_doc):
    scale=24;ox=82;oy=145
    im=Image.new('RGB',(1250,1010),'#f3f5f8');d=ImageDraw.Draw(im)
    d.text((55,28),'DENAH CANONICAL 44 x 32 — 17 ZONA / 26 PINTU',font=font(30,True),fill='#172232')
    d.text((55,76),'Diagram top-down untuk batas dan koneksi. Bukan arah kamera atau desain dekorasi.',font=font(22),fill='#44556a')
    d.rectangle((ox,oy,ox+44*scale,oy+32*scale),fill='#e2e6ea',outline='#344257',width=2)
    zones=next(l['objects'] for l in map_doc['layers'] if l['name']=='zones')
    doors=next(l['objects'] for l in map_doc['layers'] if l['name']=='doors')
    for zone in zones:
        p={x['name']:x['value'] for x in zone['properties']}
        x0=ox+p['gx_min']*scale;y0=oy+p['gy_min']*scale;x1=ox+(p['gx_max']+1)*scale;y1=oy+(p['gy_max']+1)*scale
        d.rectangle((x0,y0,x1,y1),fill='#eedcc4' if p['zone_id']!='Z17' else '#d2e3e9',outline='#57697c',width=2)
        d.text(((x0+x1)/2,(y0+y1)/2),p['zone_id'],anchor='mm',font=font(22,True),fill='#273b4f')
    for door in doors:
        p={x['name']:x['value'] for x in door['properties']};x=ox+(p['gx']+.5)*scale;y=oy+(p['gy']+.5)*scale
        d.ellipse((x-4,y-4,x+4,y+4),fill='#079eb4')
    d.text((ox+10,oy+8*scale+11),'KORIDOR UTARA',font=font(17,True),fill='#44556a')
    d.text((ox+10,oy+20*scale+11),'KORIDOR SELATAN',font=font(17,True),fill='#44556a')
    d.text((55,958),'Titik cyan = pintu logis. Batas, pintu, collision dan slot tetap; material sementara dapat dipakai bersama.',font=font(20),fill='#44556a')
    im.save(OUT/'references/09-denah-canonical.png')


COMMON = '''Use case: stylized-concept.
Asset type: reusable isolated 2.5D office architecture game sprite, not a complete room.
Style: match the attached Dot office reference: clean illustrated contours, controlled soft painted shading, matte light honey oak, cool blue-gray wall panels, charcoal trims and tiny restrained cyan accents. Warm, tidy modern office; neither photorealism, pixel art nor shiny low-poly Blender render.
Camera: orthographic 2:1 DIMETRIC. R/+gx goes screen down-right (+32,+16), L/+gy goes down-left (-32,+16). Vertical world edges stay vertical on screen. A floor diamond has width:height 2:1; do not default to 30-degree true isometric or perspective vanishing points.
Lighting: upper-left of the SCREEN, soft and consistent. Generate the requested orientation explicitly, not a horizontal flip of an existing image. Match modular proportions and shared materials; no newly invented theme.
Reference roles: Image 1 is the technical geometry guide only, not an art style. Subsequent attached images are material/shading references only. They are not edit targets. The old native floor panel's diamond ratio/padding and old long-wall proportions are not authoritative geometry; the guide and this prompt control those. Ignore any characters, furniture and decorations visible in a context reference.
Output: exactly ONE complete isolated PNG image with true RGBA transparency, preferably a 1024x1024 native canvas with at least 8% transparent padding on every side. Keep the complete contour inside the canvas. No spritesheet, contact sheet, alternatives, labels, ID numbers, dimensions drawn on the image, watermark or logo. No black/white/background rectangle, fake checkerboard transparency, baked surrounding room/floor, background glow or cast shadow stretching outside the object. Keep subtle contact shading within the object.
Avoid: people, AI agents, characters, desk, chair, sofa, TV, rugs, plants, posters, bookshelves, room-specific decorations, full office/room compositions, doors added to plain-wall jobs, random objects and extra architecture beyond the requested single module.
Numbers below are engine registration targets, not annotations to draw. A larger native canvas is fine; correct geometry/proportions matter more than guessing the final packing dimensions. Do not claim exact alpha, seamless tiling, grid registration or engine acceptance without checking actual exported pixels.
'''


def prompt(spec):
    refs='\n'.join(f'Image {i+1}: {name}' for i,name in enumerate(spec['referenceFiles']))
    return f'''{COMMON}
Input images to attach, in this order:
{refs}

Primary request ({spec['code']}):
{spec['subject']}

Target geometry for later packing:
{json.dumps(spec['geometry'],ensure_ascii=False)}

Suggested downloaded filename: {spec['outputFile']}
Return the single image. Do not create a room, combine modules or generate the other jobs from this pack.
'''


def coverage(map_doc):
    layers={layer['name']:layer for layer in map_doc['layers']}
    tiles={tile['id']+ts['firstgid']:tile for ts in map_doc['tilesets'] for tile in ts.get('tiles',[])}
    floor=[]
    for gid,count in sorted(Counter(layers['floor']['data']).items()):
        if not gid:continue
        family='F03' if gid==94 else 'F04' if gid==114 else 'O01' if gid==97 else 'F01/F02'
        floor.append(dict(gid=gid,sourceType=tiles[gid]['type'],tiles=count,proposedMaterial=family))
    wall=[]
    for layer_name in ['walls_back','walls_front']:
        for gid,count in sorted(Counter(layers[layer_name]['data']).items()):
            if not gid:continue
            kind=tiles[gid]['type'];family=['G01','G02'] if 'window' in kind else ['D01','D02','D03','D04'] if 'doorway' in kind else ['W09'] if 'corner_n' in kind else ['W10'] if 'corner_s' in kind else ['W01','W02','W03','W04'] if layer_name=='walls_back' else ['W05','W06','W07','W08']
            wall.append(dict(layer=layer_name,gid=gid,sourceType=kind,count=count,candidateModules=family))
    doors=[]
    for obj in layers['doors']['objects']:
        p={x['name']:x['value'] for x in obj['properties']}
        doors.append(dict(id=obj['name'],**p,axisProposal='L' if obj['name'].startswith('door_prod_') else 'R'))
    return dict(mapSha256=SOURCE_SHA,dimensions=[map_doc['width'],map_doc['height']],zones=len(layers['zones']['objects']),
                slots=len(layers['slots']['objects']),doors=doors,floorGidCoverage=floor,wallGidCoverage=wall,
                stage='prompt inventory only; artwork generation, packing, assembly and visual/navigation QA remain',
                decorationExcluded=True,characterWorkDeferred=True,orientationMapping='Candidate family only; choose and register the actual orientation against each map boundary during assembly.')


def main():
    OUT.mkdir(exist_ok=True);LEDGER.mkdir(exist_ok=True)
    for folder in ['references','prompts','results']:(OUT/folder).mkdir(exist_ok=True)
    source_refs={FLOOR:ARCH/'floor-oak-z08.png',TALL['R']:ARCH/'wall-tall-fall-right.png',TALL['L']:ARCH/'wall-tall-rise-right.png',LOW['R']:ARCH/'wall-low-fall-right.png',LOW['L']:ARCH/'wall-low-rise-right.png',DOOR:ARCH/'doorframe-open-fall-right.png',PILLAR:ARCH/'pillar-corner-cyan.png',CONTEXT:ROOT/'docs/visual-migration/evidence/dot-z08-components-2026-10-05/z08-room-candidate.png'}
    provenance=[]
    for name,source in source_refs.items():
        shutil.copyfile(source,OUT/'references'/name)
        provenance.append(dict(file='references/'+name,source=source.relative_to(ROOT).as_posix(),sha256=hashlib.sha256(source.read_bytes()).hexdigest(),role='style/material reference only; source bytes unchanged'))
    diagram();map_doc=json.loads(SOURCE_MAP.read_text(encoding='utf-8'));plan(map_doc)
    summary=coverage(map_doc)
    dump(OUT/'MAP_COVERAGE.json',summary)
    dump(OUT/'REFERENCE_PROVENANCE.json',provenance)
    for spec in SPEC:
        group=OUT/'prompts'/spec['group'];group.mkdir(exist_ok=True)
        (group/(spec['outputFile'].replace('.png','.txt'))).write_text(prompt(spec),encoding='utf-8',newline='\n')
    dump(OUT/'ASSET_MANIFEST.json',dict(schemaVersion=1,scope='environment foundation, not room decoration or character production',assets=SPEC))
    (OUT/'00_MASTER_STYLE.txt').write_text(COMMON,encoding='utf-8',newline='\n')
    required=sum(s['required'] for s in SPEC)
    rows=['# Mulai dari lingkungan dasar kantor',f'\n**{len(SPEC)} prompt: {required} inti + {len(SPEC)-required} opsional**, dengan foto referensi asli Dot, panduan geometri dan denah canonical. Paket prompt sudah siap; artwork baru belum digenerate atau dipasang.',
          '\n## Cara pakai di GPT web',
          '\n1. Mulai dari F01 (oak), W01/W02 (dinding dua arah), lalu P01 (pilar) untuk mengunci bahan dan cahaya. Lanjutkan seluruh kelompok 01–07. Semua prompt sudah mandiri; master style tidak perlu dipaste ulang.',
          '2. Buka file .txt suatu asset di folder `prompts`. Attach PNG dari daftar **Input images to attach** di prompt tersebut, sesuai urutan, dari folder `references`. Paste seluruh prompt, lalu generate satu asset. Gambar `09-denah-canonical.png` untuk memahami batas kantor; bukan instruksi membuat seluruh kantor dalam satu gambar.',
          '3. Download PNG asli hasil GPT (bukan screenshot atau preview JPEG); simpan di `results` dengan nama yang tertulis di prompt. Satu PNG = satu komponen. Gambar hitam pada preview reference transparan bukan permintaan background hitam.',
          '4. ZIP folder results per kelompok (lantai, dinding, pilar, pintu, kaca, transisi, outdoor) atau sekaligus dan kirim balik. Tidak perlu menjadikan semua asset satu spritesheet. File opsional G03/G04 tidak wajib untuk tahap inti.',
          '5. Jika gambar salah, gunakan `REPAIR_PROMPT.txt` dengan hasil generated sebagai edit target. Sumber Dot adalah referensi, bukan otomatis asset modular yang sudah lulus seam/alpha/geometri.',
          '\n## Batas tahap ini',
          '\nPertahankan suasana Z08: oak hangat, panel blue-gray, trim charcoal, aksen cyan kecil dan cahaya kiri atas. Struktur dipakai ulang di seluruh 17 zona. Material indoor sementara F01/F02 dipakai bersama; tema/dekorasi per ruangan diputuskan nanti. Pintu, batas, 133 slot dan jalur tidak digeser untuk menyesuaikan hasil gambar.',
          '\nSengaja tidak ada prompt karakter, meja, kursi, sofa, TV, rug, tanaman, poster, papan atau penataan ruangan. Kusen/window/pilar adalah struktur. Kolam Z17 sudah ada pada denah: air dan bibirnya termasuk dasar lingkungan; kursi/umbrella/dekorasinya ditunda. Tidak ada penambahan lantai gedung, tangga, elevator, atap yang menutupi interior atau zona baru.',
          '\n## Definisi 100% lingkungan general',
          '\nStatus 100% baru tercapai setelah seluruh asset inti digenerate, alpha/geometri/seam diperiksa dan dipacking, lalu seluruh lantai/struktur lama di 17 zona dan dua koridor diganti tanpa merusak 26 pintu dan jalur. Asset inti harus dipasang dan diperiksa di browser pada overview/detail, tema terang/gelap, seam lantai 3×3, sambungan dinding, sudut, kusen serta batas kolam. Foto yang terlihat bagus saja belum memenuhi ini. G03/G04 adalah pilihan partisi kaca untuk penataan berikutnya.',
          '\n**Saat paket ini dibuat: 0/36 asset inti baru telah digenerate; pemasangan foundation belum dimulai.** Asset Dot sebelumnya adalah sumber referensi. `MAP_COVERAGE.json` mencatat seluruh tipe lantai/dinding dan 26 pintu dari map aktual; pemilihan arah dan pivot final dilakukan saat assembly.',
          '\n## Daftar prompt dan foto yang perlu diattach',
          '\n| ID | Asset | Status | Foto / panduan | Prompt |\n|---|---|---|---|---|']
    all_prompts=['# Semua prompt lingkungan general\n\nSetiap bagian berdiri sendiri. Attach gambar sesuai daftar pada prompt. Satu bagian = satu PNG.\n']
    for spec in SPEC:
        path='prompts/'+spec['group']+'/'+spec['outputFile'].replace('.png','.txt')
        refs=', '.join(f'[{n}](references/{n})' for n in spec['referenceFiles'])
        rows.append(f'| {spec["code"]} | {spec["title"]} | {"Inti" if spec["required"] else "Opsional"} | {refs} | [Buka]({path}) |')
        all_prompts.append(f'\n## {spec["code"]} — {spec["title"]}\n\n```text\n{prompt(spec)}```\n')
    rows += ['\n## Foto suasana (referensi, bukan target layout)',f'\n![Suasana sumber Z08](references/{CONTEXT})',f'\n![Panduan geometri](references/{GUIDE})','\n![Denah canonical, bukan desain dekorasi](references/09-denah-canonical.png)']
    (OUT/'START_HERE.md').write_text('\n'.join(rows)+'\n',encoding='utf-8',newline='\n')
    (OUT/'ALL_PROMPTS.md').write_text(''.join(all_prompts),encoding='utf-8',newline='\n')
    (OUT/'REPAIR_PROMPT.txt').write_text('''Edit only the generated asset attached as Image 1. Fix this one issue: [STATE THE OBSERVED ISSUE, e.g. opaque background / wrong slope / cropped top / mismatch at repeat edges]. Keep the same single object, material palette, contour language, upper-left screen lighting and requested module dimensions. Match the attached technical guide for strict 2:1 dimetric geometry. Preserve the other correct features. Return one complete RGBA PNG with true transparent margins, no checkerboard or background scene. Do not add furniture, decoration or characters. Do not horizontally mirror the output or claim engine/seam QA was performed.\n''',encoding='utf-8')
    (OUT/'results/README.txt').write_text('Folder ini belum berisi artwork baru. Simpan PNG asli hasil GPT sesuai nama pada ASSET_MANIFEST.json. ZIP hasil per kelompok dan kirim kembali untuk packing, pemasangan dan QA.\n',encoding='utf-8')
    with (OUT/'CHECKLIST.csv').open('w',encoding='utf-8-sig',newline='') as stream:
        writer=csv.writer(stream);writer.writerow(['ID','Asset','Inti','Output PNG','Generated','Alpha/Geometry/Seam Checked','Packed','Installed','Browser QA'])
        for spec in SPEC:writer.writerow([spec['code'],spec['title'],'yes' if spec['required'] else 'optional',spec['outputFile'],'pending','pending','pending','pending','pending'])
    cards=[]
    for spec in SPEC:
        refs=''.join(f'<a href="references/{name}" target="_blank"><img src="references/{name}" alt="{html.escape(name)}"><span>{name}</span></a>' for name in spec['referenceFiles'])
        text=html.escape(prompt(spec));title=html.escape(spec['title']);kind='Inti' if spec['required'] else 'Opsional'
        cards.append(f'<article><h2>{spec["code"]} · {title} <small>{kind}</small></h2><p>Simpan: <code>{spec["outputFile"]}</code></p><div class="refs">{refs}</div><details><summary>Buka prompt lengkap</summary><textarea readonly>{text}</textarea><button type="button" onclick="copyPrompt(this)">Salin prompt</button></details></article>')
    (OUT/'index.html').write_text('''<!doctype html><html lang="id"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Prompt lingkungan kantor</title><style>body{font:16px system-ui;background:#eef0f3;color:#202937;max-width:1050px;margin:35px auto;padding:0 20px}h1{font-size:32px}article{background:white;border:1px solid #d8dce2;border-radius:12px;padding:22px;margin:22px 0}h2{font-size:22px}small{font-size:12px;padding:5px 10px;background:#e2eef0;border-radius:20px;margin-left:8px}.refs{display:flex;flex-wrap:wrap;gap:16px}.refs a{width:240px;font-size:12px;overflow-wrap:anywhere;color:#30435c}.refs img{display:block;width:240px;height:190px;object-fit:contain;background:#e9edf1;border:1px solid #d9dfe8;margin-bottom:8px}textarea{width:100%;box-sizing:border-box;height:320px;margin:16px 0;padding:12px;font:14px monospace}button,summary{cursor:pointer}button{padding:10px 18px;background:#293f53;color:white;border:0;border-radius:6px}a{color:#235a7c}p{line-height:1.6}code{font-size:14px}</style><h1>Bangun lingkungan dasar kantor</h1><p>38 prompt · 36 inti + 2 partisi kaca opsional. Foto sumber Dot dilampirkan per asset. Karakter, furniture, dekorasi dan penataan tiap ruang ditunda.</p><p>Buka prompt, attach gambar yang ditampilkan sesuai urutan, lalu generate satu PNG. Simpan nama yang tercantum dan kirim ZIP hasilnya untuk dipasang. <a href="START_HERE.md">Panduan</a> · <a href="ALL_PROMPTS.md">Semua prompt</a> · <a href="CHECKLIST.csv">Checklist</a></p><p><strong>Ini paket prompt, belum artwork terpasang. 0/36 inti baru generated.</strong></p>'''+''.join(cards)+'''<script>async function copyPrompt(button){const input=button.previousElementSibling;input.select();try{await navigator.clipboard.writeText(input.value)}catch(error){document.execCommand('copy')}button.textContent='Prompt tersalin';}</script></html>''',encoding='utf-8',newline='\n')
    dump(LEDGER/'asset-specs.json',dict(assets=SPEC,references=provenance,coverage=summary))
    assert len(SPEC)==38 and required==36
    assert len({s['code'] for s in SPEC})==len(SPEC)
    assert len({s['outputFile'] for s in SPEC})==len(SPEC)
    for spec in SPEC:
        assert all((OUT/'references'/ref).is_file() for ref in spec['referenceFiles'])
        assert all(Image.open(OUT/'references'/ref).width>0 for ref in spec['referenceFiles'])
    for record in provenance:
        assert hashlib.sha256((OUT/record['file']).read_bytes()).hexdigest()==record['sha256']
    assert summary['zones']==17 and len(summary['doors'])==26 and summary['slots']==133
    file_records=[dict(file=p.relative_to(OUT).as_posix(),sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in sorted(OUT.rglob('*')) if p.is_file() and p.name!='PACKAGE_FILES.json' and (p.parent.name!='results' or p.name=='README.txt')]
    dump(OUT/'PACKAGE_FILES.json',file_records)
    zip_path=OUT.with_suffix('.zip')
    with zipfile.ZipFile(zip_path,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
        for item in file_records:archive.write(OUT/item['file'],OUT.name+'/'+item['file'])
        archive.write(OUT/'PACKAGE_FILES.json',OUT.name+'/PACKAGE_FILES.json')
    with zipfile.ZipFile(zip_path) as archive:assert archive.testzip() is None
    result=dict(prompts=len(SPEC),required=required,optional=len(SPEC)-required,references=len(source_refs)+2,
                sourcePNGsByteIdentical=len(source_refs),generatedArtwork=0,coveredFloorTypes=len(summary['floorGidCoverage']),
                coveredWallTypes=len(summary['wallGidCoverage']),doors=26,zones=17,slots=133,
                zip=str(zip_path),sha256=hashlib.sha256(zip_path.read_bytes()).hexdigest(),files=len(file_records)+1,crcPassed=True)
    dump(LEDGER/'package-check.json',result)
    print(json.dumps(result,ensure_ascii=False))


if __name__=='__main__':main()
