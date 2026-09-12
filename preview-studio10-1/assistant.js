import {evidenceAnswer,PROJECT_ID} from './knowledge.js';
const $=s=>document.querySelector(s);
export class EvidenceAssistant {
 constructor(getContext,showSource){this.getContext=getContext;this.showSource=showSource;this.history=new Map();this.pending=new Set();this.endpoint='';this.token='';
  $('#ai-settings').addEventListener('click',()=>$('#ai-dialog').showModal());$('#ai-close').addEventListener('click',()=>$('#ai-dialog').close());
  $('#ai-scope').addEventListener('change',()=>this.refresh());$('#ai-mode').addEventListener('change',()=>this.refresh());
  $('#ai-connect-form').addEventListener('submit',async e=>{e.preventDefault();const status=$('#ai-connection-status');try{const url=new URL($('#ai-endpoint').value.trim());if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('请填写不含密钥或查询参数的 HTTPS 服务地址');this.endpoint=url.href.replace(/\/$/,'');this.token=$('#ai-access-token').value;status.textContent='正在检查服务…';const res=await fetch(this.endpoint+'/health',{signal:AbortSignal.timeout(10000)});const body=await res.json();if(!res.ok||body.project!==PROJECT_ID||!body.configured)throw new Error('服务尚未配置密钥与访问口令');status.textContent='服务可达。发送问题时会校验访问口令。';$('#ai-mode').value='deepseek';this.refresh();}catch(error){status.textContent=error.message||'连接失败';}});
 }
 context(){return {...this.getContext(),projectId:PROJECT_ID,scope:$('#ai-scope').value};}
 key(c){return c.scope+':'+(c.scope==='project'?PROJECT_ID:c.scope==='compare'?[...c.compared].sort().join(','):c.parcelId);}
 refresh(){const c=this.context(),key=this.key(c),container=$('#answer');container.replaceChildren();$('#ai-context').textContent=c.scope==='project'?'整个虚构项目 · 12宗地块':c.scope==='compare'?'比较清单 · '+c.compared.join(' / '):'当前地块 · '+c.parcelId;
  const messages=this.history.get(key)||[];if(!messages.length)container.textContent='询问地块事实、评分原因、差异或待补资料。回答附平台内部来源。';
  for(const m of messages){const card=document.createElement('article');card.className='qa-message';const q=document.createElement('strong');q.textContent=m.question;card.append(q);const badge=document.createElement('small');badge.textContent=m.mode==='deepseek'?'DeepSeek · 模型生成，需复核':'本地证据检索 · 未调用模型';card.append(badge);if(m.error){const note=document.createElement('p');note.className='notice';note.textContent=m.error+'；已提供本地证据回答。';card.append(note);}const a=document.createElement('p');a.textContent=m.answer;card.append(a);for(const s of m.sources||[]){const button=document.createElement('button');button.className='source-chip';button.textContent='['+s.id+'] '+s.title;button.addEventListener('click',()=>this.showSource(s.title,s.source+'\n\n'+s.text));card.append(button);}container.append(card);}
  const waiting=this.pending.has(key);$('#question-form button').disabled=waiting;$('#question-form button').textContent=waiting?'…':'↑';if(waiting){const p=document.createElement('p');p.textContent='正在检索并生成回答…';container.append(p);}
 }
 async ask(question){const c=this.context(),key=this.key(c);if(this.pending.has(key))return;if(c.scope==='compare'&&c.compared.length<2){$('#answer').textContent='请先将至少2宗地块加入比较清单。';return;}this.pending.add(key);this.refresh();let answer;
  try{if($('#ai-mode').value==='deepseek'){if(!this.endpoint||!this.token)throw new Error('DeepSeek服务尚未连接');const response=await fetch(this.endpoint+'/ask',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+this.token},body:JSON.stringify({...c,question}),signal:AbortSignal.timeout(50000)});const body=await response.json();if(!response.ok)throw new Error(body.error||'模型服务暂不可用');if(typeof body.answer!=='string'||!Array.isArray(body.sources)||body.mode!=='deepseek')throw new Error('模型响应格式无效');answer=body;}else answer=evidenceAnswer(question,c);
  }catch(error){answer={...evidenceAnswer(question,c),error:error.message||'模型请求失败'};}
  const messages=this.history.get(key)||[];messages.push({question,...answer});this.history.set(key,messages.slice(-12));this.pending.delete(key);this.refresh();
 }
}
