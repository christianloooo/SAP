const R='/Users/me/Documents/Codex/2026-10-24/lets-create-a-3d-model';
const C={bg:'#FFFFFF',ink:'#152238',blue:'#0065D9',navy:'#10294D',line:'#CCD6E2',soft:'#EEF5FD',mid:'#61738A',teal:'#177766',red:'#A74037'};
const refs='Layout inspiration: Elevate 2026 A T&T, PROSPER 2025, PepsiCo and Poppi, W Consulting BCG 2024, and LBSW Consulting Group Finals BSC Case Competition. Their unrelated client facts and logos are not part of this proposal.';
function box(s,x,y,w,h,fill=C.bg,stroke='none'){return s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:stroke,width:stroke==='none'?0:1}});}
function txt(s,t,x,y,w,h,size=26,bold=false,color=C.ink,align='left',font='Arial'){
 const a=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});a.text=String(t);a.text.typeface=font;a.text.style={fontSize:size,bold,color,alignment:align,verticalAlignment:'middle'};return a;
}
function band(s,t,x,y,w,h=50,color=C.navy){box(s,x,y,w,h,color);txt(s,t,x+16,y+4,w-32,h-8,25,true,'#FFFFFF');}
function themeFrame(s,d){
 s.background.fill=C.bg;
 txt(s,'SAP RETAIL SIGNAL  /  PLUS ONE BRAINCELL',56,18,990,24,13,true,C.mid);
 txt(s,d.eyebrow,56,48,1180,22,15,true,C.blue);
 txt(s,d.title,56,76,1328,49,d.title.length>71?32:36,true,C.ink,'left','Georgia');
 box(s,56,137,1328,1.5,C.navy);
 txt(s,d.foot||'',56,710,1328,35,14.5,false,C.mid);
 box(s,56,762,1328,1,C.line);
 const names=['Introduction','Product','Analysis','Implementation','Conclusion'];
 const sec=d.n<=4?0:d.n<=7?1:d.n<=11?2:d.n<=20?3:4;
 if(d.n<=22)names.forEach((t,i)=>{const x=270+i*207;txt(s,t,x,772,195,22,15,i===sec,i===sec?C.blue:C.mid,'center');if(i===sec)box(s,x+27,759,141,4,C.blue);});
 else txt(s,'APPENDIX  /  Supporting evidence and calculations',270,771,1030,25,15,true,C.mid);
 txt(s,'RETAIL SIGNAL',56,774,200,21,15,true,C.navy);
 txt(s,String(d.n).padStart(2,'0'),1342,772,42,22,15,true,C.navy,'right');
 s.hidden=d.n>22;
 s.speakerNotes.text=d.notes+'\n\n'+refs+'\nRetail and persona images are generated illustrations. App images are captures of the working seeded prototype.\n'+(d.rows||d.pairs||[]).map(a=>a.join(': ')).join('\n');
}
function table(s,v,x=56,y=164,w=1328,h=520,size=24,ratios){
 const n=v.length,m=v[0].length;
 const ww=ratios||(m===2?[.35,.65]:m===3?[.27,.39,.34]:[.43,...Array(m-1).fill(.57/(m-1))]);
 const t=s.tables.add({rows:n,columns:m,left:x,top:y,width:w,height:h,columnTracks:ww.map(value=>({mode:'fr',value})),values:v});
 t.cells.block({row:0,column:0,rowCount:n,columnCount:m}).assign({fill:C.bg,textStyle:{fontSize:size,typeface:'Arial',color:C.ink},margins:{left:15,right:15,top:7,bottom:7},anchor:'center'});
 t.borders.assign({style:'solid',fill:C.line,width:.75});
 for(let r=0;r<n;r++){t.rows[r].height=h/n;for(let c=0;c<m;c++){
  const q=t.getCell(r,c);q.text.typeface='Arial';
  if(!r){q.fill=C.navy;q.text.style={fontSize:size,bold:true,color:'#FFFFFF'};}
  else {q.fill=r%2===0?'#F5F8FC':'#FFFFFF';if(c===0)q.text.bold=true;if(/total|operating contribution|cumulative|payback/i.test(String(v[r][0]))){q.fill=C.soft;q.text.bold=true;}}
 }}return t;
}
function photo(s,f,x,y,w,h,crop){s.images.add({path:`${R}/work/elevate/visual-assets/${f}.png`,alt:`AI-generated illustrative ${f}`,position:{left:x,top:y,width:w,height:h},fit:'cover',...(crop?{crop}:{})});}
function screen(s,f,x,y,w,h,c={left:0,top:0,right:0,bottom:0}){
 const a=1524*(1-c.left-c.right)/(1125*(1-c.top-c.bottom));const nw=Math.min(w,h*a),nh=nw/a;
 s.images.add({path:`${R}/work/pitch/${f}.png`,alt:`Seeded working prototype: ${f}`,position:{left:x+(w-nw)/2,top:y+(h-nh)/2,width:nw,height:nh},crop:c,fit:'contain'});
}
function numbered(s,n,title,body,x,y,w,h){
 txt(s,n,x,y,80,55,36,true,C.blue);txt(s,title,x+83,y,w-83,68,29,true,C.navy);box(s,x,y+83,w,2,C.line);txt(s,body,x,y+104,w,h-104,26);
}
function rows(s,rr,x,y,w,h,size=25){const rh=h/rr.length;rr.forEach((r,i)=>{const yy=y+i*rh;txt(s,r.length===3?`${r[0]}  ${r[1]}`:r[0],x,yy,w,43,27,true,C.navy);txt(s,r.at(-1),x,yy+49,w,rh-64,size);if(i<rr.length-1)box(s,x,yy+rh-8,w,1,C.line);});}
function revenueChart(s,x,y,w,h){
 const ch=s.charts.add('bar',{position:{left:x,top:y,width:w,height:h},title:'Modeled SAP revenue (CAD millions)',titleTextStyle:{fontSize:23,bold:true,typeface:'Arial',fill:C.navy},categories:['Year 1','Year 2','Year 3'],series:[{name:'SAP revenue',values:[3.8,14.6,38.1],fill:C.blue}],hasLegend:false,barOptions:{direction:'column',grouping:'clustered',gapWidth:95},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:23,bold:true,typeface:'Arial',fill:C.blue},numberFormatCode:'0.0'},xAxis:{textStyle:{fontSize:21,typeface:'Arial',fill:C.ink},line:{fill:C.line,width:1}},yAxis:{min:0,max:45,numberFormatCode:'0',textStyle:{fontSize:18,typeface:'Arial',fill:C.mid},majorGridlines:{fill:C.line,width:.6}},chartFill:C.bg,plotAreaFill:C.bg});ch.series.items[0].valuesFormatCode='0.0';
}
export async function build(p,data,end=38,start=0){
 if(!start)p.slides.keep([]);p.theme.defaultFont='Arial';
 for(const d of data.slides.slice(start,end)){
 const s=p.slides.add({width:1440,height:810,background:{fill:C.bg}});themeFrame(s,d);
 switch(d.type){
 case 'hero':
  photo(s,'retail-cover',749,158,635,524);
  txt(s,d.lead,56,173,652,158,67,true,C.navy,'left','Georgia');
  txt(s,'Closing the gap between a demand shift and a business response',58,355,624,147,36,true,C.navy);
  txt(s,d.body,58,545,621,116,28);
  break;
 case 'stats':
  d.stats.forEach((a,i)=>{const x=56+i*451;txt(s,a[0],x,172,408,91,66,true,C.blue);txt(s,a[1],x,266,408,40,28,true);txt(s,a[2],x,314,408,29,18,false,C.mid);});
  box(s,56,371,1328,1,C.line);txt(s,d.body,56,407,498,244,31);
  screen(s,'command',594,398,790,286,{left:.15,top:.05,right:0,bottom:.38});break;
 case 'rows':
  d.rows.forEach((r,i)=>numbered(s,r[0],r[1],r[2],56+i*451,164,414,248));
  box(s,56,444,1328,240,C.soft);screen(s,'opportunity',56,444,1328,240,{left:.16,top:.08,right:0,bottom:.68});break;
 case 'bob':
  photo(s,'bob-persona',56,165,400,320);band(s,'Bob, regional planner',56,485,400,52);txt(s,'Fictional 100-store apparel retailer',72,556,368,103,29,true);
  rows(s,d.rows,507,165,877,518,27);break;
 case 'video':{
  const names=['Fitting-room demand','Out-of-stock demand','Supply risk and response'];const pics=['instore','online','gas-impact'];
  const examples=['240 try-ons / 43 purchases','162 qualified sessions / 24 scenario units','Gas shortage / cost and margin impact'];
  for(let i=0;i<3;i++){const x=56+i*451;box(s,x,166,414,456,C.bg,C.line);band(s,`PART ${i+1}`,x,166,414,39);txt(s,names[i],x+18,218,378,84,30,true,C.navy,'center');screen(s,pics[i],x+14,316,386,172,{left:.17,top:i===2?.2:.35,right:i===2?.01:.30,bottom:i===2?.12:.28});txt(s,d.rows[i][2],x+19,504,376,57,25,true);txt(s,examples[i],x+19,568,376,43,21,false,C.mid);}
  band(s,'90-second demo: Joule explains the evidence and options. A planner approves the response.',56,643,1328,47,C.blue);break;}
 case 'partner':
  photo(s,'rfid-hardware',56,165,452,276);txt(s,'Proposed hardware partners',56,465,452,51,29,true,C.blue);txt(s,'Zebra',56,529,452,43,32,true);txt(s,'Fixed readers and antennas',56,575,452,32,25);txt(s,'Avery Dennison',56,620,452,42,32,true);txt(s,'Garment tags and inlays',56,662,452,30,25);
  table(s,d.table,546,165,838,525,21,[.32,.32,.36]);break;
 case 'after':
  band(s,'Bob’s decision',56,165,451,47);
  txt(s,'10% to 60%',56,233,451,101,59,true,C.blue);txt(s,d.sub,56,349,451,84,28,true);
  txt(s,'40 units',56,466,451,58,43,true);txt(s,'CAD 60 transfer cost / 2-day assumed transit',56,538,451,83,27);txt(s,'32 units remain uncovered',56,645,451,43,26,true,C.red);
  screen(s,'transfer',548,165,836,466,{left:.16,top:.55,right:0,bottom:0});txt(s,'Compare options, approve a transfer, and confirm receipt',558,650,816,43,27,true,C.blue);break;
 case 'market':
  txt(s,d.body,56,165,801,239,29);photo(s,'shopper',918,165,466,265);
  d.stats.forEach((a,i)=>{const x=56+i*451;band(s,a[1],x,474,414,46);txt(s,a[0],x+10,533,394,74,46,true,C.blue);txt(s,a[2],x+10,630,394,61,22);});break;
 case 'ecosystem':
  screen(s,'joule-gas',56,165,716,519,{left:.17,top:.05,right:0,bottom:0});rows(s,d.rows,815,166,569,520,24);break;
 case 'swot':
  d.quadrants.forEach((r,i)=>{const x=56+(i%2)*678,y=165+Math.floor(i/2)*265;box(s,x,y,650,244,C.bg,C.line);band(s,r[0],x,y,650,49);txt(s,r[0][0],x+22,y+76,90,101,70,true,C.blue,'center');txt(s,r[1],x+139,y+76,482,139,28);});break;
 case 'trade':
  rows(s,d.pairs,56,165,661,521,25);screen(s,'gas',766,165,618,521,{left:.16,top:.05,right:0,bottom:0});break;
 case 'timeline':{
  const gx=481,cw=74.5;band(s,'Pilot workstream',56,165,407,49);band(s,'Weeks',gx,165,903,49);
  for(let k=0;k<12;k++){txt(s,String(k+1),gx+k*cw,221,cw,37,22,true,C.blue,'center');box(s,gx+k*cw,261,1,334,C.line);}
  const spans=[[0,2],[2,3],[5,3],[8,4]],labels=['Baseline','Shadow mode','Approve and receive','Evaluate economics'];
  d.phases.forEach((r,i)=>{const yy=270+i*81;txt(s,r[1],57,yy,392,43,27,true);txt(s,r[0].toLowerCase(),57,yy+43,392,25,18,false,C.mid);box(s,gx,yy+74,903,1,C.line);const [a,b]=spans[i];box(s,gx+a*cw,yy+7,b*cw-8,53,i%2?C.blue:C.navy);txt(s,labels[i],gx+a*cw+10,yy+10,b*cw-28,47,20,true,'#FFFFFF','center');});
  band(s,'Release gates: data feasible / reliable shadow results / safe actions / scale or stop',56,627,1328,58,C.soft);const q=s.shapes.items.at(-1);q.text.color=C.navy;
  s.speakerNotes.text+='\n'+d.phases.map(a=>a.join(': ')).join('\n');break;}
 case 'kpi':
  d.stats.forEach((r,i)=>{const x=56+i*451;box(s,x,172,414,377,C.bg,C.line);band(s,r[1],x,172,414,66);txt(s,r[0],x+14,276,386,122,85,true,C.blue,'center');txt(s,r[2],x+26,429,362,90,25,false,C.ink,'center');});
  box(s,56,579,1328,111,C.soft);txt(s,d.body,77,589,1286,91,28,true);break;
 case 'pricing':{
  txt(s,d.big,56,162,725,81,54,true,C.blue);txt(s,d.sub,825,165,559,90,27);
  const ch=s.charts.add('bar',{position:{left:56,top:282,width:450,height:383},title:'CAD 8,000 per equipped store',titleTextStyle:{fontSize:23,bold:true,typeface:'Arial',fill:C.navy},categories:['Equipment','Distribution','Installation'],series:[{name:'Partner allocation (CAD)',values:[5000,1000,2000],fill:C.blue}],hasLegend:false,barOptions:{direction:'bar',grouping:'clustered',gapWidth:85},dataLabels:{showValue:true,position:'outEnd',textStyle:{fontSize:21,bold:true,typeface:'Arial',fill:C.blue},numberFormatCode:'#,##0'},xAxis:{textStyle:{fontSize:19,typeface:'Arial',fill:C.ink}},yAxis:{min:0,max:6000,numberFormatCode:'#,##0',textStyle:{fontSize:18,typeface:'Arial',fill:C.mid},majorGridlines:{fill:C.line,width:.6}},chartFill:C.bg,plotAreaFill:C.bg});ch.series.items[0].valuesFormatCode='#,##0';
  table(s,d.table,548,282,836,405,23,[.36,.64]);break;}
 case 'roi':
  table(s,d.table,56,165,858,518,23,[.36,.18,.46]);
  d.stats.forEach((r,i)=>{const yy=165+i*265;box(s,954,yy,430,244,i?C.soft:C.bg,C.line);band(s,r[1],954,yy,430,47,i?C.blue:C.navy);txt(s,r[0],973,yy+74,392,69,44,true,i?C.red:C.blue);txt(s,r[2],973,yy+160,392,61,25);});break;
 case 'financial':
  revenueChart(s,56,165,527,506);table(s,d.table,620,165,764,523,20,[.45,.1833,.1833,.1834]);break;
 case 'value':{
  band(s,'One product connects the demand signal to a response the business can verify',56,165,1328,48);
  const titles=['01  Fitting-room demand','02  Out-of-stock demand','03  Supply risk and response'];const bodies=['Reveal customer interest before checkout.','Qualify demand for unavailable sizes.','Trace exposure and compare a response.'];
  titles.forEach((t,i)=>{const x=56+i*451;box(s,x,236,414,177,C.bg,C.line);txt(s,t,x+16,247,382,60,27,true,C.blue);txt(s,bodies[i],x+16,322,382,73,25);});
  d.rows.forEach((r,i)=>{const x=56+i*337;txt(s,r[0],x,453,313,43,27,true,C.navy);box(s,x,508,313,2,C.line);txt(s,r[1],x,530,307,154,24);});break;}
 case 'cta':
  txt(s,d.big,56,170,620,106,75,true,C.blue);txt(s,d.sub,56,300,620,133,30,true);txt(s,d.body,56,468,620,210,28);
  photo(s,'warehouse',739,165,645,519,{left:.3,top:0,right:0,bottom:0});break;
 case 'sources':{
  const rr=d.entries.map(a=>[a[0],a[1]]);if(d.n===37){rr[1][1]='Ingram Micro: global locations\nTD SYNNEX: regional coverage\nRedington: global presence\nFull links in speaker notes';s.speakerNotes.text+='\n'+d.entries[1][1];}table(s,[['Reference','Source and scope'],...rr],56,165,1328,524,19,[.23,.77]);break;}
 default:
  if(!d.table)throw Error('Unhandled slide '+d.n);
  table(s,d.table,56,165,1328,d.body?397:520,d.table.length>=7?23:25,d.n===34?[.31,.69]:d.n===26?[.36,.35,.15,.14]:d.n===38?[.28,.12,.60]:undefined);
  if(d.body)txt(s,d.body,72,590,1296,97,26);
 }
 }
 return {slides:p.slides.items.length};
}
