import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [countriesPath,regionsPath,riversPath]=process.argv.slice(2);
if(!riversPath)throw new Error('Usage: node scripts/build-entry-geography.mjs countries.geojson regions.geojson rivers.geojson');
const sources=[];
async function load(path){const text=await readFile(path,'utf8');sources.push({file:path.split('/').pop(),sha256:createHash('sha256').update(text).digest('hex')});return JSON.parse(text);}
const countries=await load(countriesPath),regions=await load(regionsPath),rivers=await load(riversPath);
const polygons=geometry=>geometry.type==='Polygon'?[geometry.coordinates]:geometry.coordinates;
const korea=countries.features.filter(f=>['KOR','PRK'].includes(f.properties.code??f.properties.ADM0_A3)).flatMap(f=>polygons(f.geometry));
const seoul=regions.features.find(f=>f.properties.iso_3166_2==='KR-11');
if(!korea.length||!seoul)throw new Error('Required geographic features missing');
const han=[];
for(const feature of rivers.features.filter(f=>f.properties.name==='Han')){
  const lines=feature.geometry.type==='LineString'?[feature.geometry.coordinates]:feature.geometry.coordinates;
  for(const line of lines){let run=[];for(const p of line){if(p[0]>126.5&&p[0]<127.4&&p[1]>37.35&&p[1]<37.9)run.push(p);else {if(run.length>1)han.push(run);run=[];}}if(run.length>1)han.push(run);}
}
if(!han.length)throw new Error('Han River geometry missing');
const data={korea,seoul:polygons(seoul.geometry),han};
const body='// Generated from Natural Earth; see assets/entry-particles.md.\nexport default '+JSON.stringify(data)+';\n';
await writeFile(new URL('../data/entry-geography-20260919.js',import.meta.url),body);
console.log(JSON.stringify({bytes:Buffer.byteLength(body),polygons:korea.length,seoul:seoul.properties.name,riverPaths:han.length,sources},null,2));
