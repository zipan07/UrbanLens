// Small SDF glyph ranges are generated from the user's system fonts.
// This keeps all map labels available without a third-party glyph server.
import TinySDF from '@mapbox/tiny-sdf';
import Pbf from 'pbf';
export function installLocalFonts(maplibre) {
 const cache=new Map();let sdf;
 maplibre.addProtocol('local-font',async ({url})=>{
   const range=url.match(/\/(\d+)-(\d+)\.pbf$/);if(!range)throw new Error('Invalid glyph range');
   const begin=Number(range[1]),end=Number(range[2]);if(end-begin!==255||begin<0||end>65535)throw new Error('Invalid glyph range');
   if(cache.has(begin))return {data:cache.get(begin).slice(0)};
   sdf??=new TinySDF({fontSize:24,buffer:3,radius:8,cutoff:.25,fontFamily:'sans-serif'});
   const p=new Pbf();
   p.writeMessage(1,(_,stack)=>{
     stack.writeStringField(1,'Local Regular');stack.writeStringField(2,`${begin}-${end}`);
     for(let id=begin;id<=end;id++){
       const g=sdf.draw(String.fromCodePoint(id));
       stack.writeMessage(3,(_,glyph)=>{
         glyph.writeVarintField(1,id);glyph.writeBytesField(2,g.data);glyph.writeVarintField(3,g.glyphWidth);glyph.writeVarintField(4,g.glyphHeight);glyph.writeSVarintField(5,g.glyphLeft);glyph.writeSVarintField(6,g.glyphTop);glyph.writeVarintField(7,Math.round(g.glyphAdvance));
       },null);
     }
   },null);
   const bytes=p.finish().slice().buffer;cache.set(begin,bytes);return {data:bytes.slice(0)};
 });
}
