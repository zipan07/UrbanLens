export async function extractDocument(bytes,name){
 if(!name.toLowerCase().endsWith('.pdf'))return undefined;
 const base=new URL('./vendor/pdfjs/',document.baseURI),pdfjs=await import(new URL('pdf.min.mjs',base).href);pdfjs.GlobalWorkerOptions.workerSrc=new URL('pdf.worker.min.mjs',base).href;
 const task=pdfjs.getDocument({data:bytes.slice(),cMapUrl:new URL('cmaps/',base).href,cMapPacked:true,isEvalSupported:false,useSystemFonts:true,stopAtErrors:true});const pdf=await task.promise;
 try{if(pdf.numPages>200)throw Error('PDF 最多 200 页');const pages=[];let length=0;for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n),content=await page.getTextContent(),text=content.items.map(i=>i.str+(i.hasEOL?'\n':' ')).join('');length+=text.length;if(text.length>100000||length>1500000)throw Error('PDF 文本过大，请拆分文件');pages.push({page:n,text});page.cleanup();}return pages;}finally{await pdf.destroy();}
}
