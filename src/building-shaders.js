export const BUILDING_VERTEX_SHADER=`#version 300 es
precision highp float;
layout(location=0) in vec3 a_position;
layout(location=1) in vec3 a_normal;
layout(location=2) in vec3 a_color;
layout(location=3) in vec3 a_uv;
layout(location=4) in float a_kind;
layout(location=5) in float a_material;
layout(location=6) in float a_ao;
uniform mat4 u_matrix;
out vec3 v_position;out vec3 v_color;out vec3 v_normal;out vec3 v_uv;out float v_ao;
flat out int v_kind;flat out int v_material;flat out int v_style;flat out int v_variation;
void main(){v_position=a_position;v_color=a_color;v_normal=a_normal;v_uv=a_uv;v_ao=a_ao;int code=int(a_kind+.5);v_kind=code%16;v_style=(code/16)%16;v_variation=code/256;v_material=int(a_material+.5);gl_Position=u_matrix*vec4(a_position,1.0);}`;
export const BUILDING_FRAGMENT_SHADER=`#version 300 es
precision highp float;precision highp int;precision highp sampler2DArray;
in vec3 v_position;in vec3 v_color;in vec3 v_normal;in vec3 v_uv;in float v_ao;
flat in int v_kind;flat in int v_material;flat in int v_style;flat in int v_variation;
uniform sampler2DArray u_albedo;uniform sampler2DArray u_normal;uniform sampler2DArray u_rough;
uniform float u_night;uniform float u_ink;uniform float u_detail;uniform float u_textures;
uniform vec3 u_view;
out vec4 fragColor;
vec3 mappedNormal(vec3 n,vec2 uv){vec3 dp1=dFdx(v_position),dp2=dFdy(v_position);vec2 duv1=dFdx(uv),duv2=dFdy(uv);vec3 p2=cross(dp2,n),p1=cross(n,dp1);vec3 t=p2*duv1.x+p1*duv2.x,b=p2*duv1.y+p1*duv2.y;float scale=inversesqrt(max(max(dot(t,t),dot(b,b)),1e-8));vec3 map=texture(u_normal,vec3(uv,float(v_material))).xyz*2.0-1.0;map.xy*=.48;return normalize(mat3(t*scale,b*scale,n)*map);}
void main(){
 if(v_kind==7){fragColor=vec4(.10,.16,.21,mix(.15,.08,u_night));return;}
 vec3 n=normalize(v_normal);if(dot(n,normalize(u_view))<0.0)n=-n;vec2 uv=v_uv.xy/max(v_uv.z,.0001);vec3 color=v_color;float rough=.76;
 if(v_material>0&&u_textures>.5){vec3 sampleColor=texture(u_albedo,vec3(uv,float(v_material))).rgb;rough=texture(u_rough,vec3(uv,float(v_material))).r;float strength=v_kind==6?1.0:v_kind==0?.78:v_kind==4?.72:.42;color=v_kind==6?sampleColor:mix(color,mix(sampleColor,color*(.55+dot(sampleColor,vec3(.2126,.7152,.0722))*.9),v_kind==0?.60:.18),strength);n=mappedNormal(n,uv);}
 float glassAmount=0.0;
 if(v_kind>0&&v_kind<6){
 vec2 spacing=v_kind==2?vec2(4.2,4.6):v_kind==3?vec2(4.8,4.2):v_kind==4?vec2(5.8,4.8):vec2(3.6,3.1);vec2 opening=vec2(v_kind==2?.89:.62,.59);float bottom=.20;
 if(v_style>0){
  spacing=v_style==1?vec2(3.0,3.05):v_style==2?vec2(3.9,3.25):v_style==3?vec2(5.0,3.8):v_style==4?vec2(3.5,3.9):v_style==5?vec2(2.9,3.9):v_style==6?vec2(5.8,4.8):v_style==7?vec2(3.6,3.1):vec2(3.3,3.2);
  opening=v_style==1?vec2(.48,.61):v_style==2?vec2(.64,.65):v_style==3?vec2(.88,.43):v_style==4?vec2(.42,.76):v_style==5?vec2(.93,.83):v_style==6?vec2(.72,.35):v_style==7?vec2(.72,.74):vec2(.66,.67);
  spacing*=.92+float(v_variation)*.04;bottom=v_style==6?.54:v_style==3?.32:v_style==7?.12:.16;
 }
 float physical=v_material==1?3.0:v_material==2?4.0:v_material==3?2.0:v_material==4?1.0:v_material==5?2.5:1.0;vec2 wallUV=uv*physical,cell=fract(wallUV/spacing),edge=max(fwidth(wallUV/spacing)*1.15,vec2(.001));float left=(1.0-opening.x)*.5,right=1.0-left,upper=min(.97,bottom+opening.y);
 float win=smoothstep(left-edge.x,left+edge.x,cell.x)*(1.0-smoothstep(right-edge.x,right+edge.x,cell.x))*smoothstep(bottom-edge.y,bottom+edge.y,cell.y)*(1.0-smoothstep(upper-edge.y,upper+edge.y,cell.y));
 float random=fract(sin(dot(floor(wallUV/spacing)+vec2(float(v_style)*3.7,float(v_variation)*5.1),vec2(12.9898,78.233)))*43758.5453),reflectSky=pow(1.0-max(dot(n,normalize(u_view)),0.0),2.0);
 vec3 glass=mix(vec3(.13,.23,.28),vec3(.54,.73,.84),.22+reflectSky*.50+random*.13);if(v_style>0){vec3 tint=v_variation==0?vec3(.29,.39,.37):v_variation==1?vec3(.28,.35,.42):v_variation==2?vec3(.34,.32,.28):v_variation==3?vec3(.25,.37,.36):vec3(.33,.36,.39);glass=mix(glass,tint,.48);}
 glass*=.80+.20*smoothstep(.05,.9,cell.y);glass=mix(glass,mix(vec3(.025,.07,.12),vec3(.99,.72,.32),step(.58,random)),u_night);
 if(v_kind==3&&v_style==0){glass=mix(vec3(.15,.20,.19),vec3(.26,.30,.24),cell.y);float arch=1.0-smoothstep(.29,.32,length(vec2((cell.x-.5)*.9,max(cell.y-.55,0.0))));win*=arch;}
 // Different frame divisions, roller blinds and occasional unlit/opaque panes.
 if(v_style>0){float paneU=(cell.x-left)/max(opening.x,.01),panes=v_style==2?3.0:v_style==1||v_style==8?2.0:1.0,mullion=1.0-smoothstep(.018,.035,min(fract(paneU*panes),1.0-fract(paneU*panes)));float transom=(v_style==1||v_style==4)?1.0-smoothstep(.012,.026,abs(cell.y-(bottom+opening.y*.68))):0.0;vec3 frame=v_variation<2?vec3(.64,.64,.60):vec3(.22,.26,.27);glass=mix(glass,frame,max(mullion,transom)*.82);float blind=step(.72,random)*smoothstep(upper-(.12+random*.13),upper,cell.y);glass=mix(glass,vec3(.66,.63,.55),blind*.65*(1.0-u_night));if(v_style==7)glass*=.77;}
 glassAmount=win*u_detail*(v_kind==5?.35:1.0);color=mix(color,glass,glassAmount);rough=mix(rough,.18,glassAmount);
 float frame=(1.0-smoothstep(.012,.05,min(cell.y,1.0-cell.y)));color*=1.0-frame*.18*u_detail;
 float sill=smoothstep(upper-.01,upper+.01,cell.y)*(1.0-smoothstep(upper+.03,upper+.07,cell.y));color=mix(color,color*.65,sill*u_detail*(v_kind==2?.35:1.0));
 if(v_style==3||v_style==5)color=mix(color,color*.70,smoothstep(.03,.08,cell.y)*(1.0-smoothstep(.17,.21,cell.y))*.6);
 if(v_style==7){float rail=(1.0-smoothstep(.012,.028,abs(cell.y-.35)))*smoothstep(left,left+.02,cell.x)*(1.0-smoothstep(right-.02,right,cell.x));color=mix(color,vec3(.47,.53,.53),rail*u_detail);}
 }

 vec3 sun=normalize(vec3(-.55,-.7,1.25));float diffuse=max(dot(n,sun),0.0),sky=.5+.5*n.z,ambient=.38+.19*sky,ao=mix(.67,1.0,smoothstep(0.0,.38,v_ao));vec3 h=normalize(sun+normalize(u_view));float spec=pow(max(dot(n,h),0.0),mix(80.0,9.0,rough))*(1.0-rough)*.32;
 float light=mix(ambient+diffuse*.49,.39+sky*.19+diffuse*.13,u_night);vec3 shaded=color*light*ao+vec3(1.0,.93,.82)*spec*(1.0-u_night);if(v_kind==6)shaded=mix(color*mix(.88,.53,u_night),shaded,.48);if(u_night>.5&&glassAmount>.0)shaded+=color*glassAmount*.25;
 float gray=dot(shaded,vec3(.2126,.7152,.0722));shaded=mix(shaded,mix(vec3(gray),vec3(.83,.81,.74),.16),u_ink*.75);fragColor=vec4(clamp(shaded,0.0,1.0),1.0);
}`;
