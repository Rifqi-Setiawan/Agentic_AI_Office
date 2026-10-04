// Adapted from pack_characters.js / pack_environment.js. Explicit output, no production copy.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const packer=require('../../frontend/node_modules/free-tex-packer-core');
const [inputArg,outputArg,name='sprite',scaleArg='2']=process.argv.slice(2);
if(!inputArg||!outputArg) throw new Error('Usage: node pack_dom_atlas.mjs INPUT OUTPUT NAME EXPORT_SCALE');
const input=path.resolve(inputArg),output=path.resolve(outputArg),exportScale=Number(scaleArg);
if(input===output||!Number.isFinite(exportScale)||exportScale<=0) throw new Error('Separate output and positive export scale required');
const images=fs.readdirSync(input).filter(f=>f.endsWith('.png')).sort().map(file=>({path:file,contents:fs.readFileSync(path.join(input,file))}));
if(!images.length) throw new Error('No input PNGs');
const packed=await new Promise((resolve,reject)=>packer(images,{
  textureName:name,width:2048,height:2048,fixedSize:false,padding:2,
  allowRotation:false,detectIdentical:true,allowTrim:true,
  exporter:'Pixi',removeFileExtension:false,textureFormat:'png',
},(files,error)=>error?reject(error):resolve(files)));
const jsonFiles=packed.filter(f=>f.name.endsWith('.json'));
if(jsonFiles.length!==1) throw new Error('Multiple atlas pages require a manifest update; refusing partial export');
for(const item of jsonFiles) {
  const atlas=JSON.parse(item.buffer.toString());
  if(Object.values(atlas.frames).some(f=>f.rotated)) throw new Error('Rotated frame refused');
  atlas.meta.exportScale=exportScale;
  atlas.meta.logicalAnchor={x:.5,y:.92};
  atlas.meta.styleVersion='AO_CLAUDE_2P5D_V1_CANDIDATE';
  atlas.meta.finalArt=false; // Rendering, marker and identity review are still required.
  item.buffer=Buffer.from(JSON.stringify(atlas,null,2));
}
fs.mkdirSync(output,{recursive:true});
for(const item of packed) fs.writeFileSync(path.join(output,item.name),item.buffer);
console.log(JSON.stringify({frames:images.length,exportScale,allowRotation:false,allowTrim:true,output,finalArt:false}));
