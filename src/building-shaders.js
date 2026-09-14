export const BUILDING_VERTEX_SHADER=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec3 a_color;
layout(location=3) in vec3 a_uv;
layout(location=4) in float a_kind;
layout(location=5) in float a_material;
layout(location=6) in float a_ao;
layout(location=7) in vec4 a_facade;
uniform mat4 u_matrix;
out vec4 v_facade;out vec3 v_position;out vec3 v_color;out vec3 v_normal;out vec3 v_uv;out float v_ao;
flat out int v_kind;flat out int v_material;flat out int v_style;flat out int v_variation;
void main(){v_facade=a_facade;v_position=a_position;v_color=a_color;v_normal=a_normal;v_uv=a_uv;v_ao=a_ao;int code=int(a_kind+.5);v_kind=code%16;v_style=(code/16)%16;v_variation=code/256;v_material=int(a_material+.5);gl_Position=u_matrix*vec4(a_position,1.0);}`;
export const BUILDING_FRAGMENT_SHADER=`#version 300 es
precision highp float;precision highp int;precision highp sampler2DArray;
in vec4 v_facade;in vec3 v_position;in vec3 v_color;in vec3 v_normal;in vec3 v_uv;in float v_ao;
flat in int v_kind;flat in int v_material;flat in int v_style;flat in int v_variation;
uniform sampler2DArray u_albedo;uniform sampler2DArray u_normal;uniform sampler2DArray u_rough;
uniform float u_night;uniform float u_ink;uniform float u_detail;uniform float u_textures;
uniform vec3 u_view;
out vec4 fragColor;
vec3 mappedNormal(vec3 n,vec2 uv){vec3 dp1=dFdx(v_position),dp2=dFdy(v_position);vec2 duv1=dFdx(uv),duv2=dFdy(uv);vec3 p2=cross(dp2,n),p1=cross(n,dp1);vec3 t=p2*duv1.x+p1*duv2.x,b=p2*duv1.y+p1*duv2.y;float scale=inversesqrt(max(max(dot(t,t),dot(b,b)),1e-8));vec3 map=texture(u_normal,vec3(uv,float(v_material))).xyz*2.0-1.0;map.xy*=.18;return normalize(mat3(t*scale,b*scale,n)*map);}
void main(){
 if(v_kind==7){fragColor=vec4(.20,.27,.32,mix(.08,.045,u_night));return;}
 vec3 n=normalize(v_normal);if(dot(n,normalize(u_view))<0.0)n=-n;vec2 uv=v_uv.xy/max(v_uv.z,.0001);vec3 color=v_color;float rough=.76;
 if(v_material>0&&u_textures>.5){vec3 sampleColor=texture(u_albedo,vec3(uv,float(v_material))).rgb;rough=texture(u_rough,vec3(uv,float(v_material))).r;float strength=v_kind==6?1.0:v_kind==0?.38:v_kind==4?.30:.18;color=v_kind==6?sampleColor:mix(color,mix(sampleColor,color*(.55+dot(sampleColor,vec3(.2126,.7152,.0722))*.9),v_kind==0?.60:.18),strength);n=mappedNormal(n,uv);}
 float glassAmount=0.0;
 if(v_kind>0&&v_kind<6){
 vec2 spacing=v_kind==2?vec2(4.2,4.6):v_kind==3?vec2(4.8,4.2):v_kind==4?vec2(5.8,4.8):vec2(3.6,3.1);vec2 opening=vec2(v_kind==2?.89:.62,.59);float bottom=.20;
 if(v_style>0){
  spacing=v_style==1?vec2(3.0,3.05):v_style==2?vec2(3.9,3.25):v_style==3?vec2(5.0,3.8):v_style==4?vec2(3.5,3.9):v_style==5?vec2(2.9,3.9):v_style==6?vec2(5.8,4.8):v_style==7?vec2(3.6,3.1):vec2(3.3,3.2);
  opening=v_style==1?vec2(.48,.61):v_style==2?vec2(.64,.65):v_style==3?vec2(.88,.43):v_style==4?vec2(.42,.76):v_style==5?vec2(.93,.83):v_style==6?vec2(.72,.35):v_style==7?vec2(.72,.74):vec2(.66,.67);
  spacing*=.92+float(v_variation)*.04;bottom=v_style==6?.54:v_style==3?.32:v_style==7?.12:.16;
 }
 // Window coordinates are metres, independent of image texture size or world origin.
 vec2 wallUV=v_facade.z>0.0?v_facade.xy:uv;
 float wallWidth=v_facade.z,wallHeight=v_facade.w;
 float columns=max(1.0,floor(max(0.0,wallWidth-1.2)/spacing.x)),floors=max(1.0,floor(max(0.0,wallHeight-.55)/spacing.y+.5));
 if(wallWidth>0.0)spacing=vec2(max(.1,wallWidth-1.2)/columns,max(.1,wallHeight-.55)/floors);
 vec2 grid=(wallUV-vec2(wallWidth>0.0?.6:0.0,.2))/spacing,cell=fract(grid),pixel=fwidth(grid),edge=max(pixel,vec2(.002));
 // Subpixel windows dissolve into the facade instead of shimmering as a dark checkerboard.
 float lod=u_detail*(1.0-smoothstep(.12,.36,max(pixel.x,pixel.y)));
 float left=(1.0-opening.x)*.5,right=1.0-left,upper=min(.94,bottom+opening.y);
 float win=smoothstep(left-edge.x,left+edge.x,cell.x)*(1.0-smoothstep(right-edge.x,right+edge.x,cell.x))*smoothstep(bottom-edge.y,bottom+edge.y,cell.y)*(1.0-smoothstep(upper-edge.y,upper+edge.y,cell.y));
 float bounds=wallWidth>0.0?step(.6,wallUV.x)*(1.0-step(wallWidth-.6,wallUV.x))*step(.2,wallUV.y)*(1.0-step(wallHeight-.35,wallUV.y))*step(2.3,wallWidth)*step(2.7,wallHeight):1.0;
 win*=bounds;
 float random=fract(sin(dot(floor(grid)+vec2(float(v_style)*3.7,float(v_variation)*5.1),vec2(12.9898,78.233)))*43758.5453);
 float facing=clamp(dot(n,normalize(u_view)),0.0,1.0),reflectSky=pow(1.0-facing,3.0);
 vec3 glass=mix(vec3(.33,.42,.47),vec3(.60,.69,.74),.22+reflectSky*.55);
 glass*=.94+.06*random;glass=mix(glass,vec3(.75,.78,.76),smoothstep(.72,.94,cell.y)*.15);
 float lit=step(.82,random);glass=mix(glass,mix(vec3(.10,.16,.22),vec3(.74,.60,.38),lit),u_night);
 if(v_kind==3&&v_style==0){float arch=1.0-smoothstep(.29,.32,length(vec2((cell.x-.5)*.9,max(cell.y-.55,0.0))));win*=arch;}
 // Narrow frames and a consistent sill, without random bright blinds or full-wall stripes.
 float paneU=(cell.x-left)/max(opening.x,.01),centerBar=1.0-smoothstep(.006+edge.x,.016+edge.x,abs(paneU-.5));
 if(v_style==1||v_style==2||v_style==8)glass=mix(glass,mix(v_color,vec3(.50,.56,.59),.35),centerBar*.48);
 float frameDist=min(min(cell.x-left,right-cell.x),min(cell.y-bottom,upper-cell.y));
 float frame=win*(1.0-smoothstep(.012,.035+max(edge.x,edge.y),frameDist));
 glass=mix(glass,v_color*.84,frame*.48);
 glassAmount=win*lod*(v_kind==5?.32:1.0);color=mix(color,glass,glassAmount);rough=mix(rough,.36,glassAmount);
 float sill=(1.0-smoothstep(.007,.028+edge.y,abs(cell.y-bottom)))*smoothstep(left,left+.02,cell.x)*(1.0-smoothstep(right-.02,right,cell.x));
 color*=1.0-sill*.10*lod*bounds;

 }

 vec3 sun=normalize(vec3(-.55,-.7,1.25));float diffuse=max(dot(n,sun),0.0),sky=.5+.5*n.z,ambient=.57+.14*sky,ao=mix(.83,1.0,smoothstep(0.0,.30,v_ao));vec3 h=normalize(sun+normalize(u_view));float spec=pow(max(dot(n,h),0.0),mix(80.0,9.0,rough))*(1.0-rough)*.18;
 float light=mix(ambient+diffuse*.30,.39+sky*.19+diffuse*.13,u_night);vec3 shaded=color*light*ao+vec3(1.0,.93,.82)*spec*(1.0-u_night);if(v_kind==6)shaded=mix(color*mix(.88,.53,u_night),shaded,.48);if(u_night>.5&&glassAmount>.0)shaded+=color*glassAmount*.25;
 float gray=dot(shaded,vec3(.2126,.7152,.0722));shaded=mix(shaded,mix(vec3(gray),vec3(.83,.81,.74),.16),u_ink*.75);fragColor=vec4(clamp(shaded,0.0,1.0),1.0);
}`;
