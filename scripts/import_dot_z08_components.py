"""Import supplied archives as immutable references; no instructions are executed."""
from pathlib import Path, PurePosixPath
import hashlib
import json
import zipfile
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]
ART = ROOT / 'art/dot-z08-components-2026-10-05'
SRC = ART / 'sources'
EVIDENCE = ROOT / 'docs/visual-migration/evidence/dot-z08-components-2026-10-05'
PACKS = ['nova-24-animation-frames','forge-nova-typing-se-frames','Z08-04-architecture-components','Z08-03-decor-components','Z08-02-gaming-components','Z08-01-workstations-components']

def digest(data):
    return hashlib.sha256(data).hexdigest()

def visible_bounds(im):
    return im.getchannel('A').point(lambda value: 255 if value > 128 else 0).getbbox()

def contact_sheet(images, path, cols=4, cell=(320,260)):
    sheet = Image.new('RGBA',(cols*cell[0],((len(images)+cols-1)//cols)*cell[1]),'#e9e7e0')
    draw = ImageDraw.Draw(sheet)
    for n,(name,im) in enumerate(images):
        x,y=n%cols*cell[0],n//cols*cell[1]
        bounds=visible_bounds(im)
        if bounds:
            tile=im.crop(bounds);tile.thumbnail((cell[0]-24,cell[1]-45),Image.Resampling.LANCZOS)
            sheet.alpha_composite(tile,(x+(cell[0]-tile.width)//2,y+5))
        draw.text((x+8,y+cell[1]-35),name,fill='#263746')
    sheet.convert('RGB').save(path)

def main():
    SRC.mkdir(parents=True,exist_ok=True);EVIDENCE.mkdir(parents=True,exist_ok=True)
    archives=[];files=[];characters=[];components=[]
    for pack in PACKS:
        archive=Path('C:/Users/Rifqi/Downloads')/(pack+'.zip')
        archives.append({'file':str(archive),'sha256':digest(archive.read_bytes())})
        with zipfile.ZipFile(archive) as z:
            assert z.testzip() is None
            for info in z.infolist():
                name=info.filename.replace('\\','/');parts=PurePosixPath(name).parts
                assert not name.startswith('/') and '..' not in parts and ':' not in name
                assert (info.external_attr >> 16) & 0o170000 != 0o120000
                if info.is_dir():continue
                target=SRC/pack/name;raw=z.read(info)
                target.parent.mkdir(parents=True,exist_ok=True)
                if target.exists():assert target.read_bytes()==raw,'Never replace an imported original'
                else:target.write_bytes(raw)
                item={'file':str(target.relative_to(ROOT)).replace('\\','/'),'archive':pack+'.zip','entry':name,'sha256':digest(raw)}
                if name.lower().endswith('.png'):
                    im=Image.open(target).convert('RGBA')
                    item.update(sourceSize=list(im.size),alphaRange=list(im.getchannel('A').getextrema()),visibleBounds128=visible_bounds(im))
                    (characters if pack in PACKS[:2] else components).append((Path(name).stem,im))
                files.append(item)
    common=json.loads((SRC/'Z08-01-workstations-components/component-manifest.json').read_text(encoding='utf-8'))
    combined={item['entry']:item for item in files if item['archive'].startswith('Z08-') and item['entry'].endswith('.png')}
    assert len(combined)==22
    for asset in common['assets']:
        item=combined[asset['file']]
        assert item['sha256']==asset['sha256']
        assert item['sourceSize']==asset['sourceSize']
    duplicates=[]
    for n in (0,1):
        old=SRC/'forge-nova-typing-se-frames'/f'nova_sit_type_se_{n}.png'
        new=SRC/'nova-24-animation-frames/nova'/f'nova_sit_type_se_{n}.png'
        duplicates.append({'file':old.name,'identical':old.read_bytes()==new.read_bytes(),'selectedPack':'nova-24-animation-frames'})
    (ART/'source-index.json').write_text(json.dumps({'archives':archives,'files':files,'roomComponents':22,'characterPngs':28,'novaSEDuplicates':duplicates,'sourceDocumentsAreMetadata':True,'mapChangesAuthorizedBySourceDocument':False,'browserQA':False},indent=2)+'\n',encoding='utf-8')
    contact_sheet(components,EVIDENCE/'source-components.png')
    contact_sheet(characters,EVIDENCE/'source-character-poses.png',cols=7,cell=(200,250))
    print(json.dumps({'archives':len(archives),'files':len(files),'componentPNGs':len(components),'characterPNGs':len(characters),'novaSEDuplicates':duplicates,'sourceHashesVerified':True}))

if __name__=='__main__':main()
