import {packedBytes} from './packed-data.js';
try{
 const bytes=await packedBytes('atlas');const url=URL.createObjectURL(new Blob([bytes],{type:'text/javascript'}));
 try{await import(url);}finally{URL.revokeObjectURL(url);}
}catch(error){
 document.querySelector('#map-loading').hidden=true;document.querySelector('#map-failure').hidden=false;
 document.querySelector('#map-error').textContent='工作台加载失败，请刷新重试。'+error.message;
}
