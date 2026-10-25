const C={blue:{r:0,g:0.439,b:0.949},navy:{r:0,g:0.169,b:0.286},muted:{r:0.322,g:0.404,b:0.482},pale:{r:0.929,g:0.961,b:1},line:{r:0.82,g:0.875,b:0.93},white:{r:1,g:1,b:1},teal:{r:0,g:0.46,b:0.42},amber:{r:0.62,g:0.36,b:0}};
await Promise.all(['Regular','Bold'].map(style=>figma.loadFontAsync({family:'Inter',style})));
const createdNodeIds=[],affectedSlides=[],assets=[],issues=[];
function track(n){createdNodeIds.push(n.id);return n}
function tx(p,s,x,y,w,size=36,color=C.navy,bold=false){const t=track(figma.createText());p.appendChild(t);t.fontName={family:'Inter',style:bold?'Bold':'Regular'};t.fontSize=size;t.characters=s;t.fills=[{type:'SOLID',color}];t.lineHeight={unit:'PERCENT',value:122};t.textAutoResize='HEIGHT';t.resize(w,Math.max(size*1.3,20));t.x=x;t.y=y;t.name=s.slice(0,55);return t}
function al(p,x,y,w,d='VERTICAL',gap=20){const a=track(figma.createAutoLayout(d));p.appendChild(a);a.fills=[];a.resize(w,1);a.primaryAxisSizingMode='AUTO';a.counterAxisSizingMode='FIXED';a.itemSpacing=gap;a.x=x;a.y=y;a.name='Content flow';return a}
function line(p,x,y,w){const r=track(figma.createRectangle());p.appendChild(r);r.resize(w,2);r.fills=[{type:'SOLID',color:C.line}];r.x=x;r.y=y;return r}
function stackText(p,s,w,size,color=C.navy,bold=false){return tx(p,s,0,0,w,size,color,bold)}
function imageSlot(p,name,x,y,w,h){const r=track(figma.createRectangle());p.appendChild(r);r.name=name;r.resize(w,h);r.fills=[{type:'SOLID',color:C.pale}];r.x=x;r.y=y;assets.push({id:r.id,name});return r}
function base(d){const s=track(figma.createSlide());s.resize(1920,1080);s.name=String(d.n).padStart(2,'0')+' · '+d.title;s.fills=[{type:'SOLID',color:d.type==='hero'||d.type==='cta'?C.pale:C.white}];s.isSkippedSlide=d.n>22;s.speakerNotes=(d.seconds?'Pacing: '+d.seconds+' seconds.\n':'Q&A appendix.\n')+d.notes;tx(s,d.eyebrow,96,60,1650,24,C.blue,true);tx(s,d.title,96,125,1728,64,C.navy,true);tx(s,d.foot||'SAP Retail Signal · Plus One Braincell · All amounts CAD unless stated',96,995,1620,21,C.muted);tx(s,String(d.n).padStart(2,'0'),1740,995,85,24,C.blue,true);affectedSlides.push({id:s.id,n:d.n,title:d.title});return s}
function table(s,vals,y=300,size=29,weights){const w=1728;const cols=vals[0].length;const ww=weights||(cols===2?[.38,.62]:cols===3?[.28,.39,.33]:[.43,.19,.19,.19]);const root=al(s,96,y,w,'VERTICAL',0);root.name='Editable data table';for(let ri=0;ri<vals.length;ri++){const r=al(root,0,0,w,'HORIZONTAL',0);r.paddingTop=ri===0?18:16;r.paddingBottom=ri===0?18:16;r.fills=[{type:'SOLID',color:ri===0?C.navy:(ri%2===1?C.pale:C.white)}];for(let j=0;j<cols;j++){const cell=al(r,0,0,w*ww[j],'VERTICAL',0);cell.paddingLeft=18;cell.paddingRight=18;stackText(cell,String(vals[ri][j]),w*ww[j]-36,ri===0?size-1:size,ri===0?C.white:C.navy,ri===0);}}return root}
function rows(s,data,y=300,x=96,w=1728,size=36){const root=al(s,x,y,w,'VERTICAL',32);for(const v of data){const r=al(root,0,0,w,'HORIZONTAL',32);if(v.length===3){stackText(r,v[0],92,46,C.blue,true);const col=al(r,0,0,w-124,'VERTICAL',12);stackText(col,v[1],w-124,size,C.navy,true);stackText(col,v[2],w-124,size-3,C.muted);}else{stackText(r,v[0],385,size,C.blue,true);stackText(r,v[1],w-417,size-2,C.navy);}}return root}
function statRow(s,data,y=330,x=96,w=1728,size=79){const r=al(s,x,y,w,'HORIZONTAL',45);for(const v of data){const c=al(r,0,0,(w-45*(data.length-1))/data.length,'VERTICAL',22);stackText(c,v[0],c.width,size,C.blue,true);stackText(c,v[1],c.width,34,C.navy,true);if(v[2])stackText(c,v[2],c.width,26,C.muted);}return r}
function build(d){const s=base(d);switch(d.type){
case 'hero':tx(s,d.lead,96,350,1710,132,C.blue,true);tx(s,d.body,96,560,1110,47);tx(s,d.big,1330,610,490,40,C.navy,true);tx(s,d.sub,1330,680,490,32,C.muted);line(s,96,870,1728);break;
case 'stats':statRow(s,d.stats,350);tx(s,d.body,96,730,1660,43);line(s,96,670,1728);break;
case 'rows':rows(s,d.rows,320);break;
case 'bob':tx(s,d.lead,96,330,470,140,C.blue,true);tx(s,d.sub,96,530,450,38,C.muted);rows(s,d.rows,330,650,1170,34);break;
case 'video':tx(s,d.lead,96,295,700,65,C.blue,true);rows(s,d.rows,430,96,760,30);imageSlot(s,'demo-poster',950,295,874,645);break;
case 'partner':tx(s,d.lead,96,275,1728,39,C.blue,true);tx(s,d.body,96,335,1728,31);table(s,d.table,460,27,[.27,.38,.35]);break;
case 'after':tx(s,d.big,96,300,1728,108,C.teal,true);tx(s,d.sub,96,450,1728,36);rows(s,d.rows,570,96,1728,30);break;
case 'market':tx(s,d.body,96,290,1728,35);statRow(s,d.stats,570,96,1728,67);break;
case 'ecosystem':rows(s,d.rows,305,96,1728,36);break;
case 'swot':d.quadrants.forEach((q,i)=>{const x=96+(i%2)*900,y=315+Math.floor(i/2)*300;tx(s,q[0],x,y,800,28,i<2?C.blue:C.teal,true);tx(s,q[1],x,y+65,800,41);});line(s,96,590,1728);break;
case 'trade':rows(s,d.pairs,320,96,1728,35);break;
case 'timeline':{const r=al(s,96,340,1728,'HORIZONTAL',35);for(const p of d.phases){const c=al(r,0,0,405,'VERTICAL',28);stackText(c,p[0],405,29,C.blue,true);stackText(c,p[1],405,45,C.navy,true);stackText(c,p[2],405,33,C.muted);}line(s,96,850,1728);break;}
case 'kpi':statRow(s,d.stats,330);tx(s,d.body,96,745,1728,40);break;
case 'pricing':tx(s,d.big,96,285,1728,84,C.blue,true);tx(s,d.sub,96,410,1728,32);table(s,d.table,550,28,[.37,.63]);break;
case 'roi':table(s,d.table,290,27,[.37,.16,.47]);statRow(s,d.stats,780,96,1728,60);break;
case 'financial':table(s,d.table,285,29,[.46,.18,.18,.18]);break;
case 'value':rows(s,d.rows,330,96,1728,37);break;
case 'cta':tx(s,d.big,96,320,900,154,C.blue,true);tx(s,d.sub,96,545,850,43);tx(s,d.body,1080,360,740,43);line(s,96,865,1728);break;
case 'sources':{const r=al(s,96,290,1728,'VERTICAL',25);for(const e of d.entries){const rr=al(r,0,0,1728,'HORIZONTAL',32);stackText(rr,e[0],440,29,C.blue,true);stackText(rr,e[1],1256,27,C.navy);}break;}
default:{const t=table(s,d.table,300,d.n>22?28:30);if(d.body)tx(s,d.body,96,Math.max(780,300+t.height+30),1728,30);}
}
return s;}
function validate(slides){for(const s of slides){const boxes=s.children.map(n=>({id:n.id,name:n.name,x:n.x,y:n.y,w:n.width,h:n.height}));for(const b of boxes){if(b.x<0||b.y<0||b.x+b.w>1921||b.y+b.h>1081)issues.push({slide:s.id,type:'outOfBounds',node:b.name,bounds:b});}for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j],ox=Math.min(a.x+a.w,b.x+b.w)-Math.max(a.x,b.x),oy=Math.min(a.y+a.h,b.y+b.h)-Math.max(a.y,b.y);if(ox>4&&oy>4)issues.push({slide:s.id,type:'overlap',nodes:[a.name,b.name]});}}}
