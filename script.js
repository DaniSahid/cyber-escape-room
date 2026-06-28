let scene,camera,renderer;
let playing=false,area="map",mf=false,mb=false,ml=false,mr=false,sprint=false;
function isMobile(){
  if(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent))return true;
  if(navigator.maxTouchPoints>0)return true;
  if(window.matchMedia&&window.matchMedia("(pointer:coarse)").matches)return true;
  return false;
}
window.exitGame=function(){
  if(confirm("Exit game? Your progress will be lost.")){
    location.reload();
  }
};
let yaw=0,pitch=0,bob=0,keys=0,knowledge=0,savedPassword="",weapon=false;
let obstacles=[],npcs=[],signs={},pc={},exitDoor={},roomWallExit={};
let currentRoom=null,currentQuestion=0,bombActive=false,bombTime=0,bombInterval=null;
let done={r1:false,r2:false,r3:false,r4:false},unlocked={r1:false,r2:false,r3:false,r4:false,exit:false};
let mainDoor={},portalMesh={},portalOn={r1:false,r2:false,r3:false,r4:false,exit:false};
let cyberEvents={usb:false,wifi:false,email:false};
const usbPos={x:15,z:5};
const wifiPos={x:-30,z:5};
const emailPos={x:0,z:28};
const limits={minX:-42,maxX:42,minZ:-42,maxZ:42};
const doors={r1:{x:-25,z:-25},r2:{x:25,z:-25},r3:{x:-25,z:20},r4:{x:25,z:20},exit:{x:0,z:-36}};
const spawn={r1:[0,1.7,-53],r2:[36,1.7,-53],r3:[-36,1.7,-53],r4:[0,1.7,-88]};

// ── SOUND ENGINE (Web Audio API — no files needed) ────────
const SFX=(function(){
  let ctx=null;
  function getCtx(){if(!ctx)ctx=new(window.AudioContext||window.webkitAudioContext)();return ctx;}
  function tone(freq,type,dur,vol,delay=0){
    try{
      let c=getCtx(),o=c.createOscillator(),g=c.createGain();
      o.connect(g);g.connect(c.destination);
      o.type=type;o.frequency.setValueAtTime(freq,c.currentTime+delay);
      g.gain.setValueAtTime(vol,c.currentTime+delay);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+delay+dur);
      o.start(c.currentTime+delay);o.stop(c.currentTime+delay+dur+0.05);
    }catch(e){}
  }
  function noise(dur,vol,delay=0){
    try{
      let c=getCtx(),buf=c.createBuffer(1,c.sampleRate*dur,c.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
      let src=c.createBufferSource(),g=c.createGain(),f=c.createBiquadFilter();
      f.type="bandpass";f.frequency.value=800;
      src.buffer=buf;src.connect(f);f.connect(g);g.connect(c.destination);
      g.gain.setValueAtTime(vol,c.currentTime+delay);
      g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+delay+dur);
      src.start(c.currentTime+delay);src.stop(c.currentTime+delay+dur+0.05);
    }catch(e){}
  }
  return{
    footstep:()=>{noise(0.06,0.08);},
    interact:()=>{tone(880,"sine",0.08,0.15);tone(1320,"sine",0.1,0.12,0.07);},
    correct:()=>{tone(523,"sine",0.12,0.2);tone(659,"sine",0.12,0.2,0.1);tone(784,"sine",0.2,0.2,0.2);},
    wrong:()=>{tone(200,"sawtooth",0.1,0.2);tone(150,"sawtooth",0.25,0.18,0.1);},
    doorOpen:()=>{tone(440,"sine",0.05,0.15);tone(660,"sine",0.1,0.12,0.05);tone(880,"sine",0.15,0.1,0.1);},
    keyGet:()=>{[0,.1,.2,.3].forEach((d,i)=>tone(523+i*130,"sine",0.12,0.18,d));},
    alarm:()=>{[0,.15,.3,.45,.6,.75].forEach((d,i)=>tone(i%2?880:660,"sawtooth",0.12,0.25,d));},
    victory:()=>{[523,659,784,1047].forEach((f,i)=>tone(f,"sine",0.3,0.2,i*0.15));},
    ambient:()=>{
      // Cyberpunk looping background music — generative, no files needed
      try{
        let c=getCtx();
        // Bass drone
        let bass=c.createOscillator(),bassGain=c.createGain();
        bass.type="sawtooth";bass.frequency.value=55;
        let bassFilter=c.createBiquadFilter();bassFilter.type="lowpass";bassFilter.frequency.value=180;
        bass.connect(bassFilter);bassFilter.connect(bassGain);bassGain.connect(c.destination);
        bassGain.gain.value=0.06;bass.start();

        // Pad chord (stacked fifths)
        [[110,0.022],[165,0.016],[220,0.012],[330,0.008]].forEach(([f,v])=>{
          let o=c.createOscillator(),g=c.createGain(),flt=c.createBiquadFilter();
          o.type="sine";o.frequency.value=f;
          flt.type="lowpass";flt.frequency.value=600;
          o.connect(flt);flt.connect(g);g.connect(c.destination);
          g.gain.value=v;o.start();
        });

        // Rhythmic pulse every 0.5s
        let pulseInterval=setInterval(()=>{
          if(!playing)return;
          let o=c.createOscillator(),g=c.createGain();
          o.type="square";o.frequency.value=110;
          o.connect(g);g.connect(c.destination);
          g.gain.setValueAtTime(0.04,c.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.18);
          o.start(c.currentTime);o.stop(c.currentTime+0.2);
        },500);

        // Hi-hat tick every 0.25s
        let hihatInterval=setInterval(()=>{
          if(!playing)return;
          try{
            let buf=c.createBuffer(1,c.sampleRate*0.05,c.sampleRate),d=buf.getChannelData(0);
            for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;
            let src=c.createBufferSource(),g=c.createGain(),flt=c.createBiquadFilter();
            flt.type="highpass";flt.frequency.value=8000;
            src.buffer=buf;src.connect(flt);flt.connect(g);g.connect(c.destination);
            g.gain.setValueAtTime(0.025,c.currentTime);
            g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+0.05);
            src.start();src.stop(c.currentTime+0.06);
          }catch(e){}
        },250);

        // Slow melody arp every 1.6s
        const melody=[220,247,262,294,330,294,262,247];let mi=0;
        let melodyInterval=setInterval(()=>{
          if(!playing)return;
          let o=c.createOscillator(),g=c.createGain(),rev=c.createConvolver();
          o.type="sine";o.frequency.value=melody[mi%melody.length];mi++;
          o.connect(g);g.connect(c.destination);
          g.gain.setValueAtTime(0.07,c.currentTime);
          g.gain.exponentialRampToValueAtTime(0.001,c.currentTime+1.4);
          o.start(c.currentTime);o.stop(c.currentTime+1.5);
        },1600);

        // Store intervals so we could stop later if needed
        window._bgIntervals=[pulseInterval,hihatInterval,melodyInterval];
      }catch(e){}
    }
  };
})();
let lastFootstep=0;
const pcpos={r1:{x:0,z:-61},r2:{x:36,z:-61},r3:{x:-36,z:-61},r4:{x:0,z:-96}};
const exitpos={r1:{x:0,z:-42},r2:{x:36,z:-42},r3:{x:-36,z:-42},r4:{x:0,z:-77}};
const roomCenter={r1:[0,-55],r2:[36,-55],r3:[-36,-55],r4:[0,-90]};
const roomNames={r1:"ROOM 1",r2:"ROOM 2",r3:"ROOM 3",r4:"ROOM 4"};

const questions={
 r2:[
  {q:"Which URL is safest?",a:["https://www.maybank2u.com.my","http://free-money-login.xyz","https://facebook-security-free.ru","http://bankgift123.tk"],c:0},
  {q:"What should you check before login?",a:["Website colour","HTTPS and correct domain","Number of images","Background music"],c:1},
  {q:"Which URL looks suspicious?",a:["https://uitm.edu.my","https://www.google.com","http://login-bank-free.xyz","https://microsoft.com"],c:2},
  {q:"A secure website usually starts with...",a:["ftp://","http:// only","https://","file://"],c:2},
  {q:"A fake website often has...",a:["misspelled domain","official domain","valid HTTPS and company URL","no login form"],c:0}
 ],
 r3:[
  {q:"Email says URGENT from unknown sender. What is it likely?",a:["Safe","Phishing","Newsletter","Receipt"],c:1},
  {q:"Best action for suspicious email?",a:["Click link","Reply password","Verify sender and link first","Forward to everyone"],c:2},
  {q:"Which is a phishing sign?",a:["Misspelled link","Expected email","Official address","No pressure"],c:0},
  {q:"Bank asks password through email. What should you do?",a:["Send password","Ignore/check official site","Click immediately","Share OTP"],c:1},
  {q:"Phishing mainly tries to steal...",a:["keyboard colour","personal data/password","screen brightness","wallpaper"],c:1}
 ],
 r4:[
  {q:"What does 2FA add?",a:["Extra security layer","More ads","Faster internet","Free games"],c:0},
  {q:"Best 2FA option?",a:["Authenticator app","Share code with friend","Write code publicly","Use same password"],c:0},
  {q:"Recovery email should be...",a:["fake","shared with strangers","secure and accessible","unknown"],c:2},
  {q:"Never share your...",a:["OTP code","favourite food","desktop colour","mouse brand"],c:0},
  {q:"If password leaks, 2FA helps because...",a:["attacker still needs second code","it deletes account","it hides screen","it changes WiFi"],c:0}
 ]
};
const tips=[
 "Use long unique passwords for every account.",
 "Always check HTTPS and the official domain before login.",
 "Never share OTP or 2FA codes with anyone.",
 "Do not click urgent links from unknown emails.",
 "Use a password manager when possible."
];

init();

function init(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0xdff7ff);
 camera=new THREE.PerspectiveCamera(75,innerWidth/innerHeight,.1,1000);camera.position.set(0,1.7,34);
 renderer=new THREE.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);document.body.appendChild(renderer.domElement);
 lights();makeOffice();makeRooms();bind();animate();
}
function bind(){
 startBtn.onclick=start;
 submitPassword.onclick=checkPassword;
 togglePassword.onclick=()=>togglePasswordView("passwordInput","togglePassword");
 document.addEventListener("keydown",keydown);
 document.addEventListener("keyup",keyup);
 document.addEventListener("mousemove",look);
 window.addEventListener("resize",resize);
 const exitBtn=document.getElementById("exitGameBtn");
 if(exitBtn)exitBtn.onclick=window.exitGame;
}
function lights(){
 scene.add(new THREE.AmbientLight(0xffffff,1.75));
 [[0,7,0],[0,7,-55],[36,7,-55],[-36,7,-55],[0,7,-90],[0,7,30]].forEach(p=>{let l=new THREE.PointLight(0xffffff,3,180);l.position.set(...p);scene.add(l)});
}
function makeOffice(){
 floor(0,0,0,88,88,0xe5e7eb);ceil(0,5,0,88,88);
 wall(0,2.5,-44,88,5,.3,0xbdefff);wall(0,2.5,44,88,5,.3,0xbdefff);wall(-44,2.5,0,.3,5,88,0xa7e8ff);wall(44,2.5,0,.3,5,88,0xa7e8ff);
 path(0,.04,0,10,82);path(0,.05,-5,76,8);path(0,.06,24,76,7);
 mainDoor.r1=doorObj(-25,-25,0x2563eb);mainDoor.r2=doorObj(25,-25,0x7c3aed);mainDoor.r3=doorObj(-25,20,0xea580c);mainDoor.r4=doorObj(25,20,0x16a34a);mainDoor.exit=doorObj(0,-36,0xdc2626);
 portalMesh.r1=portal(-25,-25.5);portalMesh.r2=portal(25,-25.5);portalMesh.r3=portal(-25,19.5);portalMesh.r4=portal(25,19.5);portalMesh.exit=portal(0,-36.5);
 label("ROOM 1\\nPASSWORD",-25,4.3,-24.6);label("ROOM 2\\nSAFE URL",25,4.3,-24.6);label("ROOM 3\\nPHISHING",-25,4.3,20.4);label("ROOM 4\\n2FA",25,4.3,20.4);label("FINAL EXIT\\n4 KEYS",0,4.3,-35.6,4.8,2,"#dc2626");
 label("CYBER SECURITY\\nTRAINING OFFICE",0,4.2,8,5.5,2);
 reception(-18,31);sofa(10,32);sofa(24,28);serverRack(-36,-20);printer(36,-20);bookshelf(-43,15);bookshelf(43,15);
 for(let p of [[-35,-32],[35,-32],[-36,5],[36,5],[-18,24],[18,24],[-10,34],[10,34]]) tree(p[0],p[1]);
 for(let p of [[0,-8],[-14,-4],[14,-4],[-22,8],[22,8]]) officeDesk(p[0],p[1]);
 npc(-8,10,"IT Officer");npc(8,22,"Security Analyst");npc(28,-6,"Cyber Mentor");
 makeUsbTrap(usbPos.x,usbPos.z);
 makeWifiStation(wifiPos.x,wifiPos.z);
 makeEmailStation(emailPos.x,emailPos.z);
}
function makeRooms(){
 room("r1",0,-55,"ROOM 1\\nCreate Strong Password");
 room("r2",36,-55,"ROOM 2\\nSafe URL Quiz");
 room("r3",-36,-55,"ROOM 3\\nPhishing Quiz");
 room("r4",0,-90,"ROOM 4\\n2FA Quiz");
}
function room(k,cx,cz,title){
 floor(cx,0,cz,24,24,0xf8fafc);ceil(cx,5,cz,24,24);
 wall(cx,2.5,cz-12,24,5,.3,0xc7f9ff);wall(cx,2.5,cz+12,24,5,.3,0xc7f9ff);wall(cx-12,2.5,cz,.3,5,24,0xa7e8ff);wall(cx+12,2.5,cz,.3,5,24,0xa7e8ff);
 roomWallExit[k]=redExitDoor(cx,cz+11.4);label("🚪 RED EXIT\\nPRESS E",cx,4.3,cz+10.6,4.5,1.7,"#dc2626");
 officeDesk(cx,cz-6,k);pc[k]=monitor(cx,1.8,cz-6.5);chair(cx-3,cz-3,k);plant(cx+8,cz-8,k);bookshelf(cx-11,cz-1,k);
 label(title+"\\nUse PC then Exit",cx,4.3,cz-11.2,5.6,2.2);
}
function floor(x,y,z,w,h,c){let m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({color:c}));m.rotation.x=-Math.PI/2;m.position.set(x,y,z);scene.add(m)}
function ceil(x,y,z,w,h){let m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({color:0xffffff}));m.rotation.x=Math.PI/2;m.position.set(x,y,z);scene.add(m)}
function wall(x,y,z,sx,sy,sz,c){let m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),new THREE.MeshStandardMaterial({color:c}));m.position.set(x,y,z);scene.add(m)}
function path(x,y,z,w,d){let m=new THREE.Mesh(new THREE.BoxGeometry(w,.04,d),new THREE.MeshStandardMaterial({color:0x93c5fd}));m.position.set(x,y,z);scene.add(m)}
function doorObj(x,z,c){let g=new THREE.Group();g.position.set(x-1.5,0,z);scene.add(g);let d=new THREE.Mesh(new THREE.BoxGeometry(3,4,.35),new THREE.MeshStandardMaterial({color:c}));d.position.set(1.5,2,0);g.add(d);let k=new THREE.Mesh(new THREE.SphereGeometry(.16,20,20),new THREE.MeshStandardMaterial({color:0xfacc15}));k.position.set(2.55,2,.25);g.add(k);return g}
function redExitDoor(x,z){
 let g=new THREE.Group();
 g.position.set(x,0,z-0.75);
 scene.add(g);

 let frame=new THREE.Mesh(
   new THREE.BoxGeometry(4.4,4.8,.35),
   new THREE.MeshStandardMaterial({color:0x7f1d1d,emissive:0x220000})
 );
 frame.position.set(0,2.4,0);
 g.add(frame);

 let d=new THREE.Mesh(
   new THREE.BoxGeometry(3.4,4.0,.5),
   new THREE.MeshStandardMaterial({color:0xff0000,emissive:0x550000})
 );
 d.position.set(0,2.05,-0.05);
 g.add(d);

 let knob=new THREE.Mesh(
   new THREE.SphereGeometry(.22,24,24),
   new THREE.MeshStandardMaterial({color:0xffff00,emissive:0x665500})
 );
 knob.position.set(1.25,2.0,-0.38);
 g.add(knob);

 let sign=makeDoorText("EXIT\\nDOOR",0,3.15,-0.42,2.2,1.0);
 g.add(sign);

 let arrow=makeDoorText("PRESS E",0,1.15,-0.42,2.2,.65);
 g.add(arrow);

 return g;
}
function makeDoorText(text,x,y,z,sx,sy){
 let c=document.createElement("canvas");
 c.width=512;c.height=256;
 let ctx=c.getContext("2d");
 ctx.fillStyle="rgba(255,255,255,.96)";
 ctx.fillRect(0,0,512,256);
 ctx.strokeStyle="#dc2626";
 ctx.lineWidth=10;
 ctx.strokeRect(0,0,512,256);
 ctx.fillStyle="#dc2626";
 ctx.font="bold 52px Arial";
 ctx.textAlign="center";
 text.split("\\n").forEach((line,i)=>ctx.fillText(line,256,90+i*70));
 let sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));
 sp.position.set(x,y,z);
 sp.scale.set(sx,sy,1);
 return sp;
}
function portal(x,z){let p=new THREE.Mesh(new THREE.PlaneGeometry(2.5,3.6),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,side:THREE.DoubleSide}));p.position.set(x,2,z);p.visible=false;scene.add(p);return p}
function setPortal(k,a){portalMesh[k].visible=a;portalOn[k]=a}
function officeDesk(x,z,a="map"){let t=new THREE.Mesh(new THREE.BoxGeometry(4.4,.25,2.1),new THREE.MeshStandardMaterial({color:0x8b5a2b}));t.position.set(x,.8,z);scene.add(t);monitor(x,1.8,z-.45);obstacles.push({area:a,x,z,w:4,d:1.9})}
function monitor(x,y,z){let s=new THREE.Mesh(new THREE.BoxGeometry(1.9,1.1,.12),new THREE.MeshStandardMaterial({color:0x111827}));s.position.set(x,y,z);scene.add(s);let d=new THREE.Mesh(new THREE.BoxGeometry(1.6,.85,.04),new THREE.MeshStandardMaterial({color:0x00ffcc,emissive:0x00aa88}));d.position.set(x,y,z+.08);scene.add(d);return d}
function chair(x,z,a="map"){let s=new THREE.Mesh(new THREE.BoxGeometry(1.4,.3,1.4),new THREE.MeshStandardMaterial({color:0x2563eb}));s.position.set(x,.5,z);scene.add(s);let b=new THREE.Mesh(new THREE.BoxGeometry(1.4,1.2,.25),new THREE.MeshStandardMaterial({color:0x1d4ed8}));b.position.set(x,1.1,z+.6);scene.add(b);obstacles.push({area:a,x,z,w:1.2,d:1.2})}
function plant(x,z,a="map"){let p=new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,.8,20),new THREE.MeshStandardMaterial({color:0xb45309}));p.position.set(x,.4,z);scene.add(p);let l=new THREE.Mesh(new THREE.ConeGeometry(1,2,16),new THREE.MeshStandardMaterial({color:0x16a34a}));l.position.set(x,1.8,z);scene.add(l);obstacles.push({area:a,x,z,w:1.1,d:1.1})}
function tree(x,z){plant(x,z,"map")}
function sofa(x,z){let s=new THREE.Mesh(new THREE.BoxGeometry(4,.6,1.5),new THREE.MeshStandardMaterial({color:0x1d4ed8}));s.position.set(x,.5,z);scene.add(s);obstacles.push({area:"map",x,z,w:3.8,d:1.3})}
function reception(x,z){let r=new THREE.Mesh(new THREE.BoxGeometry(8,1.2,2),new THREE.MeshStandardMaterial({color:0x64748b}));r.position.set(x,.8,z);scene.add(r);label("RECEPTION\\nCYBER LAB",x,2.7,z,4,1.5);obstacles.push({area:"map",x,z,w:7.6,d:1.8})}
function serverRack(x,z){let r=new THREE.Mesh(new THREE.BoxGeometry(2,3.5,1),new THREE.MeshStandardMaterial({color:0x111827}));r.position.set(x,1.8,z);scene.add(r);obstacles.push({area:"map",x,z,w:1.8,d:1})}
function printer(x,z){let p=new THREE.Mesh(new THREE.BoxGeometry(2.2,.8,1.4),new THREE.MeshStandardMaterial({color:0xf8fafc}));p.position.set(x,.8,z);scene.add(p);obstacles.push({area:"map",x,z,w:2,d:1.2})}
function bookshelf(x,z,a="map"){let b=new THREE.Mesh(new THREE.BoxGeometry(.5,3.4,4),new THREE.MeshStandardMaterial({color:0x7c4a24}));b.position.set(x,1.7,z);scene.add(b);obstacles.push({area:a,x,z,w:.8,d:3.8})}
function npc(x,z,name){let g=new THREE.Group();g.position.set(x,0,z);let b=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,1.4,16),new THREE.MeshStandardMaterial({color:0x2563eb}));b.position.y=.9;g.add(b);let h=new THREE.Mesh(new THREE.SphereGeometry(.42,20,20),new THREE.MeshStandardMaterial({color:0xfacc15}));h.position.y=1.85;g.add(h);scene.add(g);label(name+"\\nPress Q",x,3.2,z,3.5,1.4);npcs.push({x,z,name})}
function label(text,x,y,z,sx=4.5,sy=2,border="#2563eb"){let c=document.createElement("canvas");c.width=512;c.height=256;let ctx=c.getContext("2d");ctx.fillStyle="rgba(255,255,255,.97)";ctx.fillRect(0,0,512,256);ctx.strokeStyle=border;ctx.lineWidth=8;ctx.strokeRect(0,0,512,256);ctx.fillStyle="#0f172a";ctx.font="bold 30px Arial";ctx.textAlign="center";text.split("\\n").forEach((line,i)=>ctx.fillText(line,256,65+i*42));let sp=new THREE.Sprite(new THREE.SpriteMaterial({map:new THREE.CanvasTexture(c)}));sp.position.set(x,y,z);sp.scale.set(sx,sy,1);scene.add(sp);return sp}


function addOfficeRemaster(){
  label("RECEPTION DESK", -18,3.0,31,4.3,1.3,"#2563eb");
  fancyCounter(-18,30);
  sofa(8,31); sofa(17,31);
  coffeeMachine(35,30);
  waterDispenser(31,30);
  label("PANTRY ☕", 34,4.4,34,4,1.5,"#16a34a");

  for(let x of [-24,-12,12,24]){
    for(let z of [-2,8]){
      officeStation(x,z);
    }
  }

  label("MEETING ROOM", -34,4.4,34,4.5,1.5,"#7c3aed");
  meetingTable(-34,30);
  whiteboard(-42,2.8,30);

  label("SERVER ROOM\nRESTORE SYSTEM", 0,4.6,-40,5,2,"#dc2626");
  serverRack(-8,-34); serverRack(8,-34); serverRack(-14,-34); serverRack(14,-34);

  label("STOP PHISHING\nThink Before Click", -43,3.2,-10,4,1.6,"#dc2626");
  label("ENABLE 2FA\nProtect Account", 43,3.2,-10,4,1.6,"#16a34a");
  label("STRONG PASSWORD\nUse Symbols", -43,3.2,18,4,1.6,"#2563eb");
  label("CHECK HTTPS\nBefore Login", 43,3.2,18,4,1.6,"#0ea5e9");

  for(let p of [[-38,34],[38,34],[-36,-30],[36,-30],[-6,34],[6,34]]) plant(p[0],p[1],"map");
}

function fancyCounter(x,z){
  let c=new THREE.Mesh(new THREE.BoxGeometry(9,1.4,2.4),new THREE.MeshStandardMaterial({color:0x475569}));
  c.position.set(x,.9,z);scene.add(c);
  let top=new THREE.Mesh(new THREE.BoxGeometry(9.3,.18,2.7),new THREE.MeshStandardMaterial({color:0x0f172a}));
  top.position.set(x,1.65,z);scene.add(top);
  obstacles.push({area:"map",x,z,w:8.5,d:2.2});
}
function sofa(x,z){
  let s=new THREE.Mesh(new THREE.BoxGeometry(4,.7,1.6),new THREE.MeshStandardMaterial({color:0x1d4ed8}));
  s.position.set(x,.55,z);scene.add(s);
  let b=new THREE.Mesh(new THREE.BoxGeometry(4,1.2,.35),new THREE.MeshStandardMaterial({color:0x2563eb}));
  b.position.set(x,1.1,z+.65);scene.add(b);
  obstacles.push({area:"map",x,z,w:3.8,d:1.5});
}
function coffeeMachine(x,z){
  let m=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.2,1),new THREE.MeshStandardMaterial({color:0x111827}));
  m.position.set(x,1.1,z);scene.add(m);
  let screen=new THREE.Mesh(new THREE.BoxGeometry(.8,.5,.05),new THREE.MeshStandardMaterial({color:0x22c55e,emissive:0x115522}));
  screen.position.set(x,1.6,z-.53);scene.add(screen);
  obstacles.push({area:"map",x,z,w:1.5,d:1.2});
}
function waterDispenser(x,z){
  let b=new THREE.Mesh(new THREE.CylinderGeometry(.45,.55,2.2,20),new THREE.MeshStandardMaterial({color:0xdbeafe}));
  b.position.set(x,1.1,z);scene.add(b);
  obstacles.push({area:"map",x,z,w:1.1,d:1.1});
}
function officeStation(x,z){ desk(x,z,"map"); chair(x,z+2,"map"); }
function meetingTable(x,z){
  let t=new THREE.Mesh(new THREE.BoxGeometry(7,.35,2.5),new THREE.MeshStandardMaterial({color:0x7c4a24}));
  t.position.set(x,.8,z);scene.add(t);
  obstacles.push({area:"map",x,z,w:6.8,d:2.3});
  for(let i=-3;i<=3;i+=2){chair(x+i,z+2,"map");chair(x+i,z-2,"map");}
}
function whiteboard(x,y,z){
  let w=new THREE.Mesh(new THREE.BoxGeometry(.2,2.2,5),new THREE.MeshStandardMaterial({color:0xf8fafc}));
  w.position.set(x,y,z);scene.add(w);
}
function serverRack(x,z){
  let r=new THREE.Mesh(new THREE.BoxGeometry(2,3.5,1),new THREE.MeshStandardMaterial({color:0x111827}));
  r.position.set(x,1.8,z);scene.add(r);
  for(let i=0;i<5;i++){
    let l=new THREE.Mesh(new THREE.BoxGeometry(.18,.08,.06),new THREE.MeshBasicMaterial({color:i%2?0x22c55e:0x38bdf8}));
    l.position.set(x+.7,.8+i*.45,z-.53);scene.add(l);
  }
  obstacles.push({area:"map",x,z,w:1.8,d:1});
}
function chair(x,z,a="map"){
  let s=new THREE.Mesh(new THREE.BoxGeometry(1.2,.3,1.2),new THREE.MeshStandardMaterial({color:0x2563eb}));
  s.position.set(x,.55,z);scene.add(s);
  let b=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.1,.25),new THREE.MeshStandardMaterial({color:0x1d4ed8}));
  b.position.set(x,1.1,z+.55);scene.add(b);
  obstacles.push({area:a,x,z,w:1.1,d:1.1});
}
function plant(x,z,a="map"){
  let p=new THREE.Mesh(new THREE.CylinderGeometry(.45,.6,.8,20),new THREE.MeshStandardMaterial({color:0xb45309}));
  p.position.set(x,.4,z);scene.add(p);
  let l=new THREE.Mesh(new THREE.ConeGeometry(1.0,2.0,16),new THREE.MeshStandardMaterial({color:0x16a34a}));
  l.position.set(x,1.8,z);scene.add(l);
  obstacles.push({area:a,x,z,w:1.1,d:1.1});
}
function makeUsbTrap(x,z){
  // USB stick lying on a desk — red, suspicious
  let desk=new THREE.Mesh(new THREE.BoxGeometry(2.5,.6,1.5),new THREE.MeshStandardMaterial({color:0x475569}));
  desk.position.set(x,.5,z);scene.add(desk);
  let usb=new THREE.Mesh(new THREE.BoxGeometry(.18,.12,.55),new THREE.MeshStandardMaterial({color:0xdc2626,emissive:0x550000}));
  usb.position.set(x,.88,z-.1);scene.add(usb);
  let cap=new THREE.Mesh(new THREE.BoxGeometry(.18,.1,.18),new THREE.MeshStandardMaterial({color:0x7f1d1d}));
  cap.position.set(x,.88,z+.18);scene.add(cap);
  label("⚠ UNKNOWN USB\\nPress E",x,2.5,z,3.8,1.4,"#dc2626");
  obstacles.push({area:"map",x,z,w:2.3,d:1.3});
}
function makeWifiStation(x,z){
  // A router/AP device with warning sign
  let stand=new THREE.Mesh(new THREE.BoxGeometry(2.5,.6,1.5),new THREE.MeshStandardMaterial({color:0x374151}));
  stand.position.set(x,.5,z);scene.add(stand);
  let router=new THREE.Mesh(new THREE.BoxGeometry(1.4,.35,1.0),new THREE.MeshStandardMaterial({color:0xf8fafc}));
  router.position.set(x,.95,z);scene.add(router);
  let ant1=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.8,8),new THREE.MeshStandardMaterial({color:0x1f2937}));
  ant1.position.set(x-.5,1.35,z);scene.add(ant1);
  let ant2=new THREE.Mesh(new THREE.CylinderGeometry(.04,.04,.8,8),new THREE.MeshStandardMaterial({color:0x1f2937}));
  ant2.position.set(x+.5,1.35,z);scene.add(ant2);
  let led=new THREE.Mesh(new THREE.BoxGeometry(.12,.12,.05),new THREE.MeshBasicMaterial({color:0xffcc00}));
  led.position.set(x-.3,.96,z-.53);scene.add(led);
  label("📶 FREE WiFi?\\nPress E",x,2.7,z,3.8,1.4,"#d97706");
  obstacles.push({area:"map",x,z,w:2.3,d:1.3});
}
function makeEmailStation(x,z){
  // A PC with a suspicious email on screen
  let d=new THREE.Mesh(new THREE.BoxGeometry(2.5,.6,1.5),new THREE.MeshStandardMaterial({color:0x475569}));
  d.position.set(x,.5,z);scene.add(d);
  let mon=new THREE.Mesh(new THREE.BoxGeometry(1.8,1.2,.1),new THREE.MeshStandardMaterial({color:0x111827}));
  mon.position.set(x,1.5,z-.5);scene.add(mon);
  let screen=new THREE.Mesh(new THREE.BoxGeometry(1.6,1.0,.05),new THREE.MeshStandardMaterial({color:0x7f1d1d,emissive:0x3f0000}));
  screen.position.set(x,1.5,z-.44);scene.add(screen);
  label("📧 SUSPICIOUS EMAIL\\nPress E",x,3.2,z,4.2,1.4,"#dc2626");
  obstacles.push({area:"map",x,z,w:2.3,d:1.3});
}

function handleUsbTrap(){
  if(cyberEvents.usb){note("⚠ You already reported this USB threat.");return;}
  document.getElementById("cyberEventPopup").style.display="flex";
  document.getElementById("cyberEventTitle").innerText="⚠ Unknown USB Drive Found!";
  document.getElementById("cyberEventBody").innerHTML=
    "<p>You found a USB drive left on a desk with no label. It could contain malware!</p>"+
    "<p><strong>What should you do?</strong></p>"+
    "<div id='cyberEventChoices'>"+
    "<button onclick='answerCyberEvent(\"usb\",true)'>✅ Report to IT & do NOT plug it in</button>"+
    "<button onclick='answerCyberEvent(\"usb\",false)'>❌ Plug it in to see what's inside</button>"+
    "</div><p id='cyberEventResult'></p>";
}
function handleWifiStation(){
  if(cyberEvents.wifi){note("📶 You already assessed this WiFi risk.");return;}
  document.getElementById("cyberEventPopup").style.display="flex";
  document.getElementById("cyberEventTitle").innerText="📶 Free Public WiFi Detected!";
  document.getElementById("cyberEventBody").innerHTML=
    "<p>Your device found an open network: <strong>\"FREE_CYBER_CAFE_WIFI\"</strong> — no password required.</p>"+
    "<p><strong>Is it safe to connect and do online banking?</strong></p>"+
    "<div id='cyberEventChoices'>"+
    "<button onclick='answerCyberEvent(\"wifi\",false)'>❌ Yes, free WiFi is always safe!</button>"+
    "<button onclick='answerCyberEvent(\"wifi\",true)'>✅ No — use mobile data or a VPN instead</button>"+
    "</div><p id='cyberEventResult'></p>";
}
function handleEmailStation(){
  if(cyberEvents.email){note("📧 You already handled this phishing email.");return;}
  document.getElementById("cyberEventPopup").style.display="flex";
  document.getElementById("cyberEventTitle").innerText="📧 Suspicious Email Received!";
  document.getElementById("cyberEventBody").innerHTML=
    "<p>You received an email:<br><em>From: admin@mayb4nk-secure.xyz<br>Subject: URGENT — Your account will be suspended! Click here NOW.</em></p>"+
    "<p><strong>What should you do?</strong></p>"+
    "<div id='cyberEventChoices'>"+
    "<button onclick='answerCyberEvent(\"email\",false)'>❌ Click the link immediately — it looks urgent!</button>"+
    "<button onclick='answerCyberEvent(\"email\",true)'>✅ Delete it & report as phishing — fake domain!</button>"+
    "</div><p id='cyberEventResult'></p>";
}
window.answerCyberEvent=function(type,correct){
  let res=document.getElementById("cyberEventResult");
  document.getElementById("cyberEventChoices").style.display="none";
  if(correct){
    SFX.correct();
    knowledge+=10;updateHUD();
    const msgs={
      usb:"✅ Correct! Never plug in unknown USB drives. They can install malware silently. +10 Knowledge!",
      wifi:"✅ Correct! Public WiFi can be monitored by attackers (Man-in-the-Middle attack). Always use a VPN or mobile data for sensitive tasks. +10 Knowledge!",
      email:"✅ Correct! 'mayb4nk-secure.xyz' is a fake domain — a classic phishing trick. Always check the sender's real domain! +10 Knowledge!"
    };
    res.innerHTML="<span style='color:#00ff9f'>"+msgs[type]+"</span>";
  } else {
    const msgs={
      usb:"❌ Wrong! Plugging in unknown USBs is extremely dangerous — this is called a 'USB Drop Attack'. Always report to IT!",
      wifi:"❌ Wrong! Open WiFi networks can be honeypots set up by hackers to steal your data.",
      email:"❌ Wrong! This is a phishing email. The domain 'mayb4nk-secure.xyz' is fake — never click suspicious links!"
    };
    SFX.wrong();
    res.innerHTML="<span style='color:#ff2d55'>"+msgs[type]+"</span>";
  }
  cyberEvents[type]=true;
  setTimeout(()=>{
    document.getElementById("cyberEventPopup").style.display="none";
    document.body.requestPointerLock();playing=true;
  },3200);
}
window.closeCyberEvent=function(){
  document.getElementById("cyberEventPopup").style.display="none";
  document.body.requestPointerLock();playing=true;
}
function playIntro(){
  introScreen.style.display="flex";
  setTimeout(()=>{introScreen.style.display="none";},2600);
}
function restoreServerWin(){
  document.exitPointerLock();
  playing=false;
  restorePopup.style.display="flex";
  let progress=0;
  let timer=setInterval(()=>{
    progress+=5;
    restoreBarInner.style.width=progress+"%";
    restoreText.innerText=progress+"%";
    if(progress>=100){
      clearInterval(timer);
      restorePopup.style.display="none";
      SFX.victory();
      victoryPopup.style.display="flex";
    }
  },120);
}

function start(){
  playing=true;
  overlay.style.display="none";
  crosshair.style.display=hud.style.display=minimap.style.display=hands.style.display="block";
  document.getElementById("exitGameBtn").style.display="block";
  SFX.ambient();
  if(isMobile()){
    document.getElementById("mobileControls").style.display="flex";
  } else {
    document.body.requestPointerLock();
  }
  playIntro();
}
function keydown(e){let k=e.key.toLowerCase();if(k==="w"||e.key==="ArrowUp")mf=true;if(k==="s"||e.key==="ArrowDown")mb=true;if(k==="a"||e.key==="ArrowLeft")ml=true;if(k==="d"||e.key==="ArrowRight")mr=true;if(k==="shift")sprint=true;if(k==="e"){pushHands();interact()}if(k==="q")talkNPC()}
function keyup(e){let k=e.key.toLowerCase();if(k==="w"||e.key==="ArrowUp")mf=false;if(k==="s"||e.key==="ArrowDown")mb=false;if(k==="a"||e.key==="ArrowLeft")ml=false;if(k==="d"||e.key==="ArrowRight")mr=false;if(k==="shift")sprint=false}
function look(e){if(!playing)return;yaw-=e.movementX*.002;pitch-=e.movementY*.002;pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch));camera.rotation.order="YXZ";camera.rotation.y=yaw;camera.rotation.x=pitch}
function near(x,z,d){return Math.hypot(camera.position.x-x,camera.position.z-z)<d}
function interact(){
 if(!playing)return;
 if(area==="map"){
  for(let k of ["r1","r2","r3","r4"]){if(near(doors[k].x,doors[k].z,5))return handleMainDoor(k)}
  if(near(doors.exit.x,doors.exit.z,5))return handleFinalExit();
  if(near(usbPos.x,usbPos.z,3.5)){document.exitPointerLock();playing=false;return handleUsbTrap();}
  if(near(wifiPos.x,wifiPos.z,3.5)){document.exitPointerLock();playing=false;return handleWifiStation();}
  if(near(emailPos.x,emailPos.z,3.5)){document.exitPointerLock();playing=false;return handleEmailStation();}
 }else{
  if(near(pcpos[area].x,pcpos[area].z,4)&&!done[area])return usePC(area);
  if(near(exitpos[area].x,exitpos[area].z,8))return exitRoom(area);
 }
}
function handleMainDoor(k){
 if(k==="r2"&&!done.r1)return note("Complete Room 1 first.");
 if(k==="r3"&&!done.r2)return note("Complete Room 2 first.");
 if(k==="r4"&&!done.r3)return note("Complete Room 3 first.");
 if(done[k])return note(roomNames[k]+" already COMPLETE ✅");
 openDoor(k);
}
function openDoor(k){
 if(portalOn[k])return note("Walk into the white portal.");
 SFX.doorOpen();
 note("Door opening... walk into portal.");
 let d=mainDoor[k];let it=setInterval(()=>{d.rotation.y-=.04;if(d.rotation.y<=-Math.PI/2){d.rotation.y=-Math.PI/2;clearInterval(it);setPortal(k,true)}},16);
}
function usePC(k){
 if(k==="r1")openPopup("passwordPopup");else startQuiz(k);
}
function startQuiz(k){
 currentRoom=k;currentQuestion=0;showQuiz();
}
function showQuiz(){
 let q=questions[currentRoom][currentQuestion];
 quizTitle.innerText=roomNames[currentRoom]+" Challenge "+(currentQuestion+1)+"/"+questions[currentRoom].length;
 quizQuestion.innerText=q.q;quizAnswers.innerHTML="";quizResult.innerHTML="";
 q.a.forEach((ans,i)=>{let b=document.createElement("button");b.innerText=String.fromCharCode(65+i)+". "+ans;b.onclick=()=>answerQuiz(i);quizAnswers.appendChild(b)});
 openPopup("quizPopup");
}
function answerQuiz(i){
 let q=questions[currentRoom][currentQuestion];
 if(i===q.c){
  SFX.correct();
  stopBomb();quizResult.innerHTML="✅ Correct!";quizResult.style.color="#16a34a";
  currentQuestion++;
  if(currentQuestion>=questions[currentRoom].length)setTimeout(()=>completeRoom(currentRoom),500);
  else setTimeout(showQuiz,500);
 }else{
  SFX.wrong();
  quizResult.innerHTML="❌ Wrong! Bomb timer started. Try another answer fast.";quizResult.style.color="#dc2626";startBomb();
 }
}
function completeRoom(k){
 done[k]=true;
 if(k==="r2")keys=Math.max(keys,2);
 if(k==="r3")keys=Math.max(keys,3);
 if(k==="r4")keys=Math.max(keys,4);
 SFX.keyGet();
 pc[k].material.color.set(0x22c55e);updateHUD();
 closePopup("quizPopup");note(roomNames[k]+" COMPLETE! Find the RED EXIT door.");missionDisplay.innerText="🎯 Mission: Exit "+roomNames[k];
}
function checkPassword(){
 let p=passwordInput.value;let strong=p.length>=8&&/[A-Z]/.test(p)&&/[a-z]/.test(p)&&/[0-9]/.test(p)&&/[^A-Za-z0-9]/.test(p);
 if(strong){SFX.keyGet();savedPassword=p;done.r1=true;keys=Math.max(keys,1);weapon=true;hands.classList.add("hasWeapon");pc.r1.material.color.set(0x22c55e);passwordResult.innerHTML="✅ Key 1 collected. Cyber Keycard unlocked!";passwordResult.style.color="#16a34a";updateHUD();setTimeout(()=>{closePopup("passwordPopup");note("Room 1 complete! Find the RED EXIT door.");missionDisplay.innerText="🎯 Mission: Exit Room 1"},700)}
 else{SFX.wrong();passwordResult.innerHTML="❌ Weak password.";passwordResult.style.color="#dc2626"}
}
function exitRoom(k){
 area="map";camera.position.set(doors[k].x,1.7,doors[k].z+5);yaw=0;camera.rotation.y=0;
 closeMainDoor(k);
 if(done[k]){completeSign(k);missionDisplay.innerText=k==="r4"?"🎯 Mission: Go to Final Exit":"🎯 Mission: Go to next room"}
 else note("You can exit, but complete the PC task first.");
}
function closeMainDoor(k){
 setPortal(k,false);let d=mainDoor[k];let it=setInterval(()=>{d.rotation.y+=.04;if(d.rotation.y>=0){d.rotation.y=0;clearInterval(it)}},16);
}
function completeSign(k){if(signs[k])return;signs[k]=label("COMPLETE ✅",doors[k].x,5.3,doors[k].z+.4,3.4,1.2,"#22c55e")}
function handleFinalExit(){
 if(keys<4)return note("ACCESS DENIED: collect all 4 keys first.");
 openDoor("exit");
}
function enterPortals(){
 if(area!=="map")return;
 for(let k of ["r1","r2","r3","r4"]){if(portalOn[k]&&near(doors[k].x,doors[k].z-.5,2)){area=k;let s=spawn[k];camera.position.set(s[0],s[1],s[2]);yaw=Math.PI;camera.rotation.y=yaw;missionDisplay.innerText="🎯 Mission: Use PC in "+roomNames[k];note("Entered "+roomNames[k])}}
 if(portalOn.exit&&near(doors.exit.x,doors.exit.z-.5,2)){document.exitPointerLock();playing=false;finalScore.innerText="Knowledge Points: "+knowledge;restoreServerWin()}
}
function talkNPC(){
 if(area!=="map")return;
 for(let n of npcs){if(near(n.x,n.z,4)){knowledge+=5;npcText.innerHTML="<strong>"+n.name+":</strong><br><br>"+tips[Math.floor(Math.random()*tips.length)]+"<br><br><span style='color:#00ff9f;font-family:monospace'>+5 Knowledge Points</span>";updateHUD();openPopup("npcPopup");return}}
}
function startBomb(){
 if(bombActive)return;
 bombActive=true;bombTime=10;bombMini.style.display="block";bombTimer.innerText=bombTime;
 bombInterval=setInterval(()=>{bombTime--;bombTimer.innerText=bombTime;if(bombTime<=0){clearInterval(bombInterval);alert("💥 BOOM! Game restarting.");location.reload()}},1000);
}
function stopBomb(){bombActive=false;if(bombInterval)clearInterval(bombInterval);bombMini.style.display="none"}
function openPopup(id){document.exitPointerLock();playing=false;document.getElementById(id).style.display="flex"}
function closePopup(id){document.getElementById(id).style.display="none";if(!isMobile())document.body.requestPointerLock();playing=true}
window.closePopup=closePopup;
function togglePasswordView(inputId,btnId){let input=document.getElementById(inputId),btn=document.getElementById(btnId);if(input.type==="password"){input.type="text";btn.innerText="🙈 Hide"}else{input.type="password";btn.innerText="👁 Show"}}
function note(t){notification.innerText=t;notification.style.display="block";setTimeout(()=>notification.style.display="none",2500)}
function updateHUD(){keyDisplay.innerText=`🔑 Keys: ${keys}/4`;knowledgeDisplay.innerText=`🧠 Knowledge: ${knowledge}`;weaponDisplay.innerText=weapon?"🪪 Tool: Cyber Keycard":"🪪 Tool: None"}
function animate(){requestAnimationFrame(animate);if(playing){move();ui();enterPortals();mini();updateHUD();handsAnim()}renderer.render(scene,camera)}
function move(){
 let dx=0,dz=0;if(mf)dz-=1;if(mb)dz+=1;if(ml)dx-=1;if(mr)dx+=1;let len=Math.hypot(dx,dz)||1;dx/=len;dz/=len;
 let ox=camera.position.x,oz=camera.position.z,sp=sprint?.16:.10;
 let f=new THREE.Vector3();camera.getWorldDirection(f);f.y=0;f.normalize();let r=new THREE.Vector3();r.crossVectors(f,camera.up).normalize();
 camera.position.addScaledVector(f,-dz*sp);camera.position.addScaledVector(r,dx*sp);
 if(area==="map"){camera.position.x=Math.max(limits.minX,Math.min(limits.maxX,camera.position.x));camera.position.z=Math.max(limits.minZ,Math.min(limits.maxZ,camera.position.z))}
 else{let c=roomCenter[area];camera.position.x=Math.max(c[0]-10,Math.min(c[0]+10,camera.position.x));camera.position.z=Math.max(c[1]-11,Math.min(c[1]+13,camera.position.z))}
 if(hit(camera.position.x,camera.position.z)){camera.position.x=ox;camera.position.z=oz}
 if(mf||mb||ml||mr){bob+=.14;camera.position.y=1.7+Math.sin(bob)*.035;let now=Date.now();if(now-lastFootstep>320){SFX.footstep();lastFootstep=now;}}else camera.position.y=1.7;
}
function hit(x,z){for(let o of obstacles){if(o.area!==area)continue;if(x>o.x-o.w/2-.35&&x<o.x+o.w/2+.35&&z>o.z-o.d/2-.35&&z<o.z+o.d/2+.35)return true}return false}
function ui(){
 interactionText.style.display="none";
 if(area==="map"){
  for(let n of npcs){if(near(n.x,n.z,4))return showText("Press Q to talk to "+n.name)}
  for(let k of ["r1","r2","r3","r4"]){if(near(doors[k].x,doors[k].z,5))return showText(done[k]?roomNames[k]+" COMPLETE ✅":"Press E to open "+roomNames[k])}
  if(near(doors.exit.x,doors.exit.z,5))return showText(keys<4?"Exit locked: 4 keys required":"Press E to open Final Exit")
  if(near(usbPos.x,usbPos.z,3.5))return showText(cyberEvents.usb?"USB Threat Reported ✅":"Press E — Unknown USB Drive detected!")
  if(near(wifiPos.x,wifiPos.z,3.5))return showText(cyberEvents.wifi?"WiFi Risk Assessed ✅":"Press E — Suspicious Free WiFi detected!")
  if(near(emailPos.x,emailPos.z,3.5))return showText(cyberEvents.email?"Phishing Email Reported ✅":"Press E — Suspicious Email on screen!")
 }else{
  if(near(pcpos[area].x,pcpos[area].z,4)&&!done[area])return showText("Press E to use PC");
  if(near(exitpos[area].x,exitpos[area].z,8))return showText("Press E to use BIG RED EXIT DOOR");
  if(done[area])return showText("Task complete. Find RED EXIT door.");
 }
}
function showText(m){interactionText.style.display="block";interactionText.innerText=m}
function mini(){let x=camera.position.x,z=camera.position.z;if(area!=="map"){x=doors[area].x;z=doors[area].z}miniPlayer.style.left=((x-limits.minX)/(limits.maxX-limits.minX))*100+"%";miniPlayer.style.top=((z-limits.minZ)/(limits.maxZ-limits.minZ))*100+"%"}
function handsAnim(){if(mf||mb||ml||mr)hands.classList.add("walking");else hands.classList.remove("walking")}
function pushHands(){hands.classList.remove("pushing");void hands.offsetWidth;hands.classList.add("pushing");setTimeout(()=>hands.classList.remove("pushing"),380)}
function resize(){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)}

// ── MOBILE CONTROLS ──────────────────────────────────────
window.mobileE=function(){if(playing){pushHands();interact();}}
window.mobileTalkNPC=function(){if(playing)talkNPC();}

(function setupMobile(){
  if(!isMobile())return;
  const mc=document.getElementById("mobileControls");
  mc.style.display="none";

  // WASD buttons — hold to move, release to stop
  function bindBtn(id,setOn,setOff){
    const btn=document.getElementById(id);
    if(!btn)return;
    btn.addEventListener("touchstart",e=>{setOn();e.preventDefault();},{passive:false});
    btn.addEventListener("touchend",e=>{setOff();e.preventDefault();},{passive:false});
    btn.addEventListener("touchcancel",e=>{setOff();e.preventDefault();},{passive:false});
  }
  bindBtn("btnW", ()=>{mf=true;},  ()=>{mf=false;});
  bindBtn("btnS", ()=>{mb=true;},  ()=>{mb=false;});
  bindBtn("btnA", ()=>{ml=true;},  ()=>{ml=false;});
  bindBtn("btnD", ()=>{mr=true;},  ()=>{mr=false;});

  // Look by swiping right half of screen
  let lookActive=false,lx=0,ly=0;
  renderer.domElement.addEventListener("touchstart",e=>{
    for(let t of e.touches){
      if(t.clientX>innerWidth/2){lookActive=true;lx=t.clientX;ly=t.clientY;}
    }
  });
  renderer.domElement.addEventListener("touchmove",e=>{
    if(!lookActive||!playing)return;
    for(let t of e.touches){
      if(t.clientX>innerWidth/2){
        yaw-=(t.clientX-lx)*0.004;
        pitch-=(t.clientY-ly)*0.004;
        pitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch));
        camera.rotation.order="YXZ";camera.rotation.y=yaw;camera.rotation.x=pitch;
        lx=t.clientX;ly=t.clientY;
      }
    }
    e.preventDefault();
  },{passive:false});
  renderer.domElement.addEventListener("touchend",()=>{lookActive=false;});

  // Exit button
  const exitBtn=document.getElementById("exitGameBtn");
  if(exitBtn)exitBtn.onclick=window.exitGame;
})();
