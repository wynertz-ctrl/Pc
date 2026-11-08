import * as THREE from "three";

const $=s=>document.querySelector(s),T=THREE,TAU=Math.PI*2,cl=(x,a,b)=>Math.max(a,Math.min(b,x)),sm=x=>x*x*(3-2*x);
const S={on:false,state:"idle",p:0,tt:0,pw:0,rv:0,fake:false,mic:null,sp:0,cfg:{bright:1,anim:1,glow:1,vol:1,rate:.95,mute:false,greet:true,cap:false,model:"",vad:.03,fs:true,voice:"",micId:"",timeout:30,barge:true}};
try{Object.assign(S.cfg,JSON.parse(localStorage.getItem("nertz")||"{}"))}catch(e){}
const save=()=>{try{localStorage.setItem("nertz",JSON.stringify(S.cfg))}catch(e){}};
const off=()=>!navigator.onLine||S.fake||S.sim;
/* ---------- 3D orb ---------- */
const R=new T.WebGLRenderer({canvas:$("#c"),antialias:true});R.setPixelRatio(Math.min(devicePixelRatio,2));R.setClearColor(0);
const sc=new T.Scene(),cam=new T.PerspectiveCamera(50,1,.1,100);cam.position.z=11;
const orb=new T.Group(),tilt=new T.Group();orb.add(tilt);sc.add(orb);
const ad={blending:T.AdditiveBlending,transparent:true,depthWrite:false,side:T.DoubleSide};
const mA=new T.MeshBasicMaterial({...ad,opacity:.6}),mB=new T.MeshBasicMaterial({...ad,opacity:.28}),mT=new T.MeshBasicMaterial({...ad,opacity:.85}),mWh=new T.LineBasicMaterial({...ad,opacity:0}),mL=new T.LineBasicMaterial({...ad,opacity:.5}),mW=new T.LineBasicMaterial({...ad,opacity:.9}),mP=new T.PointsMaterial({...ad,size:.05,opacity:.8}),mO=new T.PointsMaterial({...ad,size:.09,opacity:0});
const rnd=(i,k)=>{const x=Math.sin(i*127.1+k*311.7)*43758.5;return x-Math.floor(x)};
const N=13,rings=[];
for(let i=0;i<N;i++){
  const th=i>=N-2,r=.75+i*.23,w=i==N-1?.16:i==N-2?.11:[.07,.035,.018][i%3],n=th?(i==N-1?4:3):i%2?1:[3,5,4,6,8,7][i%6],g=new T.Group(),arcs=[],len=n==1?TAU:TAU/n*(th?.8:.72);
  for(let k=0;k<n;k++){const p=new T.Group();p.rotation.z=k*TAU/n;const m=new T.Mesh(new T.RingGeometry(r-w/2,r+w/2,Math.max(6,Math.ceil(72/n)),1,0,len),th?mT:i%3==2?mB:mA);p.add(m);g.add(p);arcs.push({m,mid:n==1?0:len/2})}
  if(i%3==1){const v=[];for(let k=0;k<96;k++){const a=k/96*TAU,c=Math.cos(a),s=Math.sin(a),q=k%4?.03:.07;v.push(c*(r+w),s*(r+w),0,c*(r+w+q),s*(r+w+q),0)}const gg=new T.BufferGeometry();gg.setAttribute("position",new T.Float32BufferAttribute(v,3));g.add(new T.LineSegments(gg,mL))}
  tilt.add(g);rings.push({g,arcs,a:rnd(i,9)*TAU,sp:(i%2?-1:1)*(.12+i*.045),tx:(rnd(i,1)-.5)*.5,ty:(rnd(i,2)-.5)*.5,z:(i-N/2)*.5,s:1+(rnd(i,3)-.3)*.12,sl:.25+(i%4)*.12})
}
const WN=128,wg=new T.BufferGeometry();wg.setAttribute("position",new T.BufferAttribute(new Float32Array((WN+1)*3),3));const wave=new T.Line(wg,mW);orb.add(wave);
const v=[];for(let k=0;k<10;k++){const a=k/10*TAU+.2,c=Math.cos(a),s=Math.sin(a),a2=a+(k%2?.12:-.12);v.push(c*3.7,s*3.7,0,c*4.5,s*4.5,0,c*4.5,s*4.5,0,Math.cos(a2)*5.3,Math.sin(a2)*5.3,0)}
const cg=new T.BufferGeometry();cg.setAttribute("position",new T.Float32BufferAttribute(v,3));const circ=new T.LineSegments(cg,mL);orb.add(circ);
const pv=[];for(let k=0;k<140;k++){const a=rnd(k,5)*TAU,r=1+rnd(k,6)*3.6;pv.push(Math.cos(a)*r,Math.sin(a)*r,(rnd(k,7)-.5)*2)}
const pg=new T.BufferGeometry();pg.setAttribute("position",new T.Float32BufferAttribute(pv,3));const parts=new T.Points(pg,mP);tilt.add(parts);
const orbs=[];[[5.3,.55,.35,170],[4.6,-.4,.9,110]].forEach(([q,tx,tz,n])=>{const v=[];for(let k=0;k<n;k++){const a=k/n*TAU;v.push(Math.cos(a)*q,Math.sin(a)*q*.55,0)}const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(v,3));const p=new T.Points(g,mO);p.rotation.set(tx,0,tz);orb.add(p);orbs.push(p)});
const fil=new T.Group();tilt.add(fil);for(let k=0;k<16;k++){const r=.5+rnd(k,11)*3.1,a0=rnd(k,12)*TAU,sp=.5+rnd(k,13)*2.2,v=[];for(let j=0;j<=40;j++){const a=a0+sp*j/40;v.push(Math.cos(a)*r,Math.sin(a)*r,0)}const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(v,3));const l=new T.Line(g,mWh);l.position.set((rnd(k,14)-.7)*.7,(rnd(k,15)-.3)*.7,(rnd(k,16)-.5)*2.6);l.rotation.set((rnd(k,17)-.5)*.5,(rnd(k,18)-.5)*.5,0);fil.add(l)}
const grid=new T.GridHelper(40,40,0x2a8cff,0x2a8cff);grid.material.transparent=true;grid.material.opacity=0;grid.material.depthWrite=false;grid.position.set(0,-4.6,-2);sc.add(grid);
const cv2=document.createElement("canvas");cv2.width=cv2.height=128;{const x=cv2.getContext("2d"),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,"rgba(255,255,255,1)");g.addColorStop(.25,"rgba(170,232,255,.7)");g.addColorStop(1,"rgba(0,0,0,0)");x.fillStyle=g;x.fillRect(0,0,128,128)}
const core=new T.Sprite(new T.SpriteMaterial({map:new T.CanvasTexture(cv2),blending:T.AdditiveBlending,depthWrite:false,transparent:true}));orb.add(core);
const nodes=[];{const lv=[];for(let k=0;k<6;k++){const a=2.2+k*.18,r=3.6+rnd(k,21)*1.2,x=Math.cos(a)*r,y=Math.sin(a)*r,s=new T.Sprite(core.material.clone());s.position.set(x,y,0);s.scale.setScalar(.3);orb.add(s);nodes.push(s);lv.push(x,y,0,Math.cos(a)*1.7,Math.sin(a)*1.7,0)}const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(lv,3));orb.add(new T.LineSegments(g,mWh))}
function fit(){R.setSize(innerWidth,innerHeight);cam.aspect=innerWidth/innerHeight;cam.updateProjectionMatrix()}addEventListener("resize",fit);fit();
const cOn=new T.Color(0x5fd4ff),cOff=new T.Color(0x2244ff),cc=new T.Color(0x5fd4ff);let bins=new Float32Array(WN),last=0;
function loop(ts){requestAnimationFrame(loop);const dt=Math.min(.05,(ts-last)/1e3||0);last=ts;
  if(S.on)S.pw=Math.min(1,S.pw+dt/3);S.p+=Math.sign(S.tt-S.p)*Math.min(Math.abs(S.tt-S.p),dt/4);const e=sm(S.p),st=S.state,A=S.cfg.anim;
  cc.lerp(off()?cOff:cOn,.08);[mA,mL,mW,mP].forEach(m=>m.color.copy(cc));mB.color.copy(cc);mT.color.copy(cc);mO.color.copy(cc);mWh.color.copy(cc).lerp(new T.Color(1,1,1),.65);mT.opacity=.85*S.cfg.bright;mWh.opacity=.55*e*S.cfg.bright;mO.opacity=.8*e*S.cfg.bright;mA.opacity=.6*S.cfg.bright;mB.opacity=.28*S.cfg.bright;mL.opacity=(.3+.3*e)*S.cfg.bright;
  const sp=st=="thinking"?2.4:st=="speaking"?1.3:.9,boost=1+5*Math.sin(Math.PI*S.p);
  rings.forEach((o,i)=>{o.a+=dt*o.sp*sp*A*boost*(st=="thinking"?Math.sin(ts/900+i):1);const pe=sm(cl(S.p*1.5-i*.03,0,1)),pa=sm(cl(S.pw*1.6-i*.07,0,1));
    o.g.rotation.set(o.tx*pe,o.ty*pe,o.a);o.g.position.set(-(N-i)*.07*pe,(N-i)*.05*pe,o.z*pe);o.g.scale.setScalar(pa*(1+(o.s-1)*pe));
    o.arcs.forEach(a=>{if(o.sl&&a.mid){const d=o.sl*pe*(1+.4*Math.sin(Math.PI*S.p));a.m.position.set(Math.cos(a.mid)*d,Math.sin(a.mid)*d,0)}})});
  orb.rotation.order="ZXY";orb.rotation.set(-1.0*e+.03*Math.sin(ts/2500)*e,.12*e,.62*e+.02*Math.sin(ts/3100)*e);circ.scale.setScalar(.6+.4*e);parts.rotation.z+=dt*.05*A;fil.rotation.z+=dt*.04*A;orbs.forEach((p,i)=>p.rotation.z+=dt*(i?-.08:.1)*A);nodes.forEach(n=>{n.material.opacity=e*.9;n.material.color.copy(cc).lerp(new T.Color(1,1,1),.5)});grid.material.opacity=.14*e*(1-S.rv);grid.material.color.copy(cc);
  /* audio / pattern */
  let tg=new Float32Array(WN),lvl=0;
  if(S.mic&&st=="listening"){S.mic.an.getByteFrequencyData(S.mic.d);for(let i=0;i<WN;i++){tg[i]=S.mic.d[Math.floor(Math.abs(i-WN/2)/(WN/2)*48)]/255;lvl+=tg[i]}lvl/=WN}
  else if(st=="speaking"){S.sp*=.94;const b=.4+.3*Math.sin(ts/75)+S.sp;for(let i=0;i<WN;i++)tg[i]=cl(b*(.5+.5*Math.sin(i*.45+ts/110)),0,1);lvl=b*.6}
  else if(st=="thinking"){for(let i=0;i<WN;i++)tg[i]=Math.pow(Math.max(0,Math.sin(i/WN*TAU*3-ts/300)),8)*.4}
  else{for(let i=0;i<WN;i++)tg[i]=Math.pow(Math.max(0,Math.cos((i/WN-(ts/6e3)%1)*TAU)),30)*.25}
  const P=wg.attributes.position;for(let i=0;i<=WN;i++){const j=i%WN;bins[j]+=(tg[j]-bins[j])*.35;const a=j/WN*TAU,r=3.85+bins[j]*.7*A;P.setXYZ(i,Math.cos(a)*r,Math.sin(a)*r,0)}P.needsUpdate=true;mW.opacity=(st=="idle"?.25:.9)*S.pw*S.cfg.bright;
  const ig=S.pw,cs=(1.3+(st=="thinking"?.25*Math.sin(ts/260):st=="speaking"?lvl*1.2:st=="listening"?lvl*.5:.12*Math.sin(ts/700)))*ig*S.cfg.glow*(S.on?1:0);
  core.scale.setScalar(cs*(1-.45*e)*(1+.8*Math.max(0,Math.sin(Math.PI*cl(S.p*8,0,1)))*(S.p<.13?1:0)));core.material.color.setRGB(.2+.8*ig,.4+.6*ig,1).lerp(off()?new T.Color(.15,.3,1):new T.Color(1,1,1),ig*.5);
  /* position: centre or review corner */
  S.rv+=(S.reviewing?1-S.rv:-S.rv)*(1-Math.exp(-dt*5));const hh=Math.tan(25*Math.PI/180)*11,hw=hh*cam.aspect,base=Math.min(1,hh*.8/4.2,hw*.8/4.2),s=base*(1-.72*S.rv),m=4.2*s+.1;
  orb.scale.setScalar(s);orb.position.set(-hw*S.rv*0+(-hw+m)*S.rv,(-hh+m)*S.rv,0);R.render(sc,cam)}
requestAnimationFrame(loop);

export {S,save,off,$,cl};
