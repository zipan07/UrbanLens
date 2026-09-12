import {EMPTY} from './geo.js';
export const THEMES={
 day:{bg:'#e8eddf',green:'#b7c9a1',civic:'#d7dccc',residential:'#e7e3d6',commercial:'#e9d8c3',industrial:'#d9d8df',other:'#dedfcf',water:'#8fbac5',shore:'#7fabaf',road:'#fffdf3',case:'#d6cbb4',rail:'#ab8db5',text:'#49665b',halo:'#f7f9ed',known:'#c5ae82',levels:'#97bfc6',unknown:'#d9d4c9',boundary:'#486d57',shadow:'#547249',sky:'#dbe8e7'},
 night:{bg:'#263b3c',green:'#324f46',civic:'#3f5351',residential:'#3b4b49',commercial:'#574f47',industrial:'#434d5b',other:'#3f4d43',water:'#284e64',shore:'#476e79',road:'#8c8a72',case:'#2c3d3d',rail:'#a991bb',text:'#ccd4b4',halo:'#293d38',known:'#d0b58a',levels:'#89b5b7',unknown:'#6b7a74',boundary:'#b0c992',shadow:'#0b2b30',sky:'#29434a'},
 ink:{bg:'#f1f0e5',green:'#d3dcc7',civic:'#e1e0d3',residential:'#edebdf',commercial:'#e5dfcb',industrial:'#e1dedc',other:'#e7e4d5',water:'#bdcfc9',shore:'#a2b6ae',road:'#fffef7',case:'#d8d4c3',rail:'#9faaa0',text:'#657564',halo:'#faf9f0',known:'#b5ae98',levels:'#a2bdb7',unknown:'#dfdcd0',boundary:'#7f967c',shadow:'#7f8c75',sky:'#f0f0e6'}
};
export function makeStyle(data,{theme='day',mode='3d',terrain=true,schematic=true,layers={}},base) {
 const c=THEMES[theme],sources={};
 for(const id of ['boundary','land','water','roads','buildings','pois'])sources[id]={type:'geojson',data:data[id],maxzoom:17,tolerance:.45};
 for(const id of ['selected','imported','measure'])sources[id]={type:'geojson',data:EMPTY()};
 const dem={type:'raster-dem',tiles:[`${base}data/terrain/{z}/{x}/{y}.png`],encoding:'terrarium',tileSize:256,minzoom:12,maxzoom:12,bounds:[118.72,31.98,118.96,32.15]};
 sources.dem={...dem};sources.hillshade={...dem};
 const style={version:8,name:`UrbanLens Xuanwu / ${theme}`,glyphs:'local-font://{fontstack}/{range}.pbf',sources,light:{anchor:'viewport',color:theme==='night'?'#fdeac5':'#fff8e9',intensity:.42,position:[1.2,220,35]},sky:{'sky-color':c.sky,'horizon-color':c.bg,'fog-color':c.bg,'sky-horizon-blend':.7,'horizon-fog-blend':.7,'fog-ground-blend':.6},layers:[]};
 if(mode==='3d'&&terrain)style.terrain={source:'dem',exaggeration:1};
 const add=(id,type,source,paint,filter,layout={},group=source)=>style.layers.push({id,type,...(source?{source}:{}),...(filter?{filter}:{}),layout:{...layout,visibility:layers[group]===false?'none':'visible'},paint});
 const eq=(p,v)=>['==',['get',p],v];
 add('background','background',null,{'background-color':c.bg});
 add('district-tint','fill','boundary',{'fill-color':theme==='night'?'#31443e':'#f5f4e7','fill-opacity':.25});
 add('land','fill','land',{'fill-color':['match',['get','category'],'green',c.green,'civic',c.civic,'residential',c.residential,'commercial',c.commercial,'industrial',c.industrial,c.other],'fill-opacity':.93});
 add('land-outline','line','land',{'line-color':theme==='night'?'#65816a':'#aebb9f','line-opacity':.25,'line-width':.5});
 add('hills','hillshade','hillshade',{'hillshade-shadow-color':c.shadow,'hillshade-highlight-color':theme==='night'?'#5c7761':'#ffffe4','hillshade-accent-color':c.shadow,'hillshade-exaggeration':.32,'hillshade-illumination-direction':315},null,{},'terrain');
 add('water','fill','water',{'fill-color':c.water,'fill-opacity':1});
 add('water-edge','line','water',{'line-color':c.shore,'line-width':1.2,'line-opacity':.6});
 const roadFilter=['all',eq('category','road'),['!=',['get','underground'],true]];
 const width=['interpolate',['linear'],['zoom'],11,['match',['get','road_class'],'major',1.7,'secondary',.8,.2],14,['match',['get','road_class'],'major',5,'secondary',3,'path',.8,1.3],18,['match',['get','road_class'],'major',28,'secondary',19,'path',3,7]];
 const casing=structuredClone(width);for(const i of [4,6,8])casing[i]=['*',casing[i],1.3];
 add('roads-case','line','roads',{'line-color':c.case,'line-width':casing},roadFilter,{'line-cap':'round','line-join':'round'});
 add('roads','line','roads',{'line-color':c.road,'line-width':width},roadFilter,{'line-cap':'round','line-join':'round'});
 add('tunnels','line','roads',{'line-color':c.case,'line-width':['interpolate',['linear'],['zoom'],12,.7,17,4],'line-dasharray':[2,2],'line-opacity':.7},['all',eq('category','road'),eq('underground',true)]);
 add('rail','line','roads',{'line-color':c.rail,'line-width':['interpolate',['linear'],['zoom'],11,1,17,3],'line-opacity':.8},eq('category','rail'),{},'rail');
 add('rail-sleepers','line','roads',{'line-color':c.road,'line-width':1,'line-dasharray':[1,3],'line-opacity':.65},eq('category','rail'),{},'rail');
 add('waterways','line','roads',{'line-color':c.water,'line-width':['interpolate',['linear'],['zoom'],11,1,17,6]},eq('category','waterway'),{},'water');
 const color=['match',['get','height_source'],'osm',c.known,'levels',c.levels,c.unknown];
 add('building-footprints','fill','buildings',{'fill-color':color,'fill-opacity':.87});
 add('building-edges','line','buildings',{'line-color':theme==='night'?'#84947c':'#b3b5a5','line-opacity':.4,'line-width':.45});
 add('building-3d','fill-extrusion','buildings',{'fill-extrusion-color':color,'fill-extrusion-height':mode==='2d'?0:schematic?['get','render_height']:['coalesce',['get','height_m'],0],'fill-extrusion-base':mode==='2d'?0:['get','render_base'],'fill-extrusion-opacity':1,'fill-extrusion-vertical-gradient':true});
 add('district-border','line','boundary',{'line-color':c.boundary,'line-width':1.3,'line-dasharray':[4,3],'line-opacity':.75});
 const catColor=['match',['get','category'],'education','#659b92','health','#c97b70','transport',c.rail,'culture','#b29967','nature','#6e9361','#9ea594'];
 const poiPaint={'circle-color':catColor,'circle-radius':['interpolate',['linear'],['zoom'],12,1.5,16,4],'circle-stroke-color':c.halo,'circle-stroke-width':1,'circle-opacity':['step',['zoom'],.3,14,.9]};
 add('poi-dots','circle','pois',poiPaint,['all',['!=',['get','category'],'place'],['!=',['get','category'],'transport']]);
 add('station-dots','circle','pois',poiPaint,eq('category','transport'),{},'rail');
 const textPaint={'text-color':c.text,'text-halo-color':c.halo,'text-halo-width':1.5,'text-halo-blur':.4};
 const textLayout={'text-field':['get','label'],'text-font':['Local Regular'],'text-size':11,'text-padding':9,'text-max-width':8,'text-variable-anchor':['top','bottom','left','right'],'text-radial-offset':.8};
 add('poi-labels','symbol','pois',textPaint,['all',['!=',['get','label'],''],['!=',['get','category'],'place'],['!=',['get','category'],'transport']],textLayout);
 style.layers.at(-1).minzoom=14;
 add('station-labels','symbol','pois',textPaint,['all',['!=',['get','label'],''],eq('category','transport')],textLayout,'rail');
 style.layers.at(-1).minzoom=14;
 add('place-labels','symbol','pois',textPaint,['all',['!=',['get','label'],''],['in',['get','category'],['literal',['nature','place']]]],{...textLayout,'text-size':14,'text-letter-spacing':.18});
 add('road-labels','symbol','roads',textPaint,['all',eq('category','road'),['!=',['get','label'],''],['in',['get','road_class'],['literal',['major','secondary']]]],{'text-field':['get','label'],'text-font':['Local Regular'],'text-size':10,'symbol-placement':'line','symbol-spacing':300,'text-letter-spacing':.12},'roads');
 style.layers.at(-1).minzoom=14;
 add('imported-fill','fill','imported',{'fill-color':'#bf8468','fill-opacity':.22});
 add('imported-edge','line','imported',{'line-color':'#ba7057','line-width':2,'line-dasharray':[3,2]});
 add('selected-fill','fill','selected',{'fill-color':'#e7c869','fill-opacity':.4},['==',['geometry-type'],'Polygon']);
 add('selected-line','line','selected',{'line-color':theme==='night'?'#f2dd8a':'#476f50','line-width':3},['!=',['geometry-type'],'Point']);
 add('selected-point','circle','selected',{'circle-color':'#e2c76a','circle-radius':8,'circle-stroke-color':c.halo,'circle-stroke-width':3},['==',['geometry-type'],'Point']);
 add('measure-line','line','measure',{'line-color':'#bc6e53','line-width':3,'line-dasharray':[2,1]},['==',['geometry-type'],'LineString']);
 add('measure-points','circle','measure',{'circle-color':'#fff9df','circle-radius':5,'circle-stroke-color':'#bc6e53','circle-stroke-width':2},['==',['geometry-type'],'Point']);
 return style;
}
