// The floor: ONE isometric building. Rooms share walls, a paved aisle runs
// between the two banks, each room has a real door, and a completed stage
// travels as a parcel from its ready bay, through its door, along the aisle,
// through the destination door, to the receiving dock.
//
// Ported from the design prototype's renderer. The characters here are drawn,
// not pasted: the concept sheets are reference for appearance and motion intent,
// NOT runtime atlases (DESIGN.md is explicit about this).
//
// Depth is one global ordered list keyed on ground support (x + y), never on a
// sprite's top edge, lift or bounce, so a parcel passing a door jamb resolves
// correctly instead of being painted in a final overlay pass.

import {
  GEOMETRY, layoutAgents, project, unproject, routeBetween, alongRoute,
  sortDrawables, counts, packageSlots, avoidLabelCollisions,
} from './core.js?v=9';

function createArt(ctx,projector){
const ink='#1a242a',cream='#e7d4a5';let t=0;
function p(x,y,z=0){const q=projector(x,y,z);return [q.x,q.y]}
    function poly(points,color,stroke){ctx.beginPath();points.forEach((q,i)=>{if(i)ctx.lineTo(Math.round(q[0]),Math.round(q[1]));else ctx.moveTo(Math.round(q[0]),Math.round(q[1]))});ctx.closePath();ctx.fillStyle=color;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke()}}
    function iso(points,color,stroke){poly(points.map(q=>p(...q)),color,stroke)}
    function line(points,color,width=1){ctx.beginPath();points.forEach((q,i)=>{if(i)ctx.lineTo(Math.round(q[0]),Math.round(q[1]));else ctx.moveTo(Math.round(q[0]),Math.round(q[1]))});ctx.strokeStyle=color;ctx.lineWidth=width;ctx.stroke()}
    function iline(points,c,l=1){line(points.map(q=>p(...q)),c,l)}
    function rect(x,y,a,b,c){ctx.fillStyle=c;ctx.fillRect(Math.round(x),Math.round(y),a,b)}
    function shade(c,n){const v=parseInt(c.slice(1),16);return '#'+[v>>16,(v>>8)&255,v&255].map(k=>Math.min(255,Math.max(0,k+n)).toString(16).padStart(2,'0')).join('')}
    function box(x,y,z,dx,dy,dz,c,outline=true){const edge=outline?shade(c,-35):null;iso([[x,y,z+dz],[x+dx,y,z+dz],[x+dx,y+dy,z+dz],[x,y+dy,z+dz]],shade(c,15),edge);iso([[x,y+dy,z],[x+dx,y+dy,z],[x+dx,y+dy,z+dz],[x,y+dy,z+dz]],shade(c,-14),edge);iso([[x+dx,y,z],[x+dx,y+dy,z],[x+dx,y+dy,z+dz],[x+dx,y,z+dz]],shade(c,-28),edge)}
    function ellipse(x,y,rx,ry,c){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=c;ctx.fill()}
    function shadow(x,y,r=20){const q=p(x,y,1);ellipse(q[0]+3,q[1]+3,r,r*.4,'#19282b55')}
    function floorRect(x,y,dx,dy,c){iso([[x,y,1],[x+dx,y,1],[x+dx,y+dy,1],[x,y+dy,1]],c)}
    function table(x,y,dx,dy,z=28,c='#977c59'){
      for(const v of [[3,3],[dx-8,3],[3,dy-8],[dx-8,dy-8]])box(x+v[0],y+v[1],0,5,5,z-3,shade(c,-26));
      box(x,y,z-4,dx,dy,5,c);iline([[x,y+dy,z+2],[x+dx,y+dy,z+2]],shade(c,31));
    }
    function book(x,y,z,c,dx=13,dy=18){box(x,y,z,dx,dy,4,c);box(x+1,y+1,z+2,dx-2,dy-2,2,'#c9be9c');floorPage(x,y,z+5,dx,dy,c)}
    function floorPage(x,y,z,dx=14,dy=17,c='#d8c9a0'){iso([[x,y,z],[x+dx,y,z],[x+dx,y+dy,z],[x,y+dy,z]],c);for(let i=4;i<dy-2;i+=4)iline([[x+2,y+i,z+.2],[x+dx-3,y+i,z+.2]],shade(c,-39))}
    function plant(x,y,z=0){box(x-6,y-5,z,12,10,12,'#9a735b');const q=p(x,y,z+12);line([[q[0],q[1]],[q[0]+1,q[1]-23]],'#526e53',2);for(let i=0;i<5;i++){const xx=q[0]+(i%2?7:-7),yy=q[1]-7-i*4;poly([[q[0],yy+4],[xx-5,yy+2],[xx-3,yy-6],[xx+5,yy-3]],i%2?'#8ba775':'#657f59')}}
    function jar(x,y,z,c='#85a9a5'){box(x,y,z,8,8,12,c);box(x+1,y+1,z+12,6,6,3,cream)}
    function lamp(x,y,z=0,lit=true){box(x-5,y-5,z,10,10,3,'#9d8656');const q=p(x,y,z+3),top=p(x,y,z+53);line([q,top],'#343c3b',3);line([[q[0]+1,q[1]], [top[0]+1,top[1]]],'#b2a07a');poly([[top[0]-9,top[1]+1],[top[0]+8,top[1]+1],[top[0]+13,top[1]+13],[top[0]-14,top[1]+13]],lit?'#dfca87':'#6d6d65',ink);if(lit){rect(top[0]-10,top[1]+13,20,2,'#e9dba0');const g=ctx.createRadialGradient(top[0],top[1]+17,0,top[0],top[1]+17,38);g.addColorStop(0,'#ebc67625');g.addColorStop(1,'#ebc67600');ellipse(top[0],top[1]+17,38,30,g)}}
    function rug(x,y,dx,dy,c){floorRect(x,y,dx,dy,shade(c,-20));floorRect(x+3,y+3,dx-6,dy-6,c);iline([[x+6,y+6,2],[x+dx-6,y+6,2],[x+dx-6,y+dy-6,2],[x+6,y+dy-6,2],[x+6,y+6,2]],shade(c,29));for(let i=8;i<dx;i+=9){iline([[x+i,y-2,1],[x+i,y+1,1]],shade(c,18));iline([[x+i,y+dy-1,1],[x+i,y+dy+2,1]],shade(c,18))}}
    function shelf(x,y,c='#7c715d',type='books'){
      box(x,y,0,58,16,44,c);for(let row=0;row<2;row++){box(x+2,y+13,3+row*21,54,6,17,shade(c,-36));box(x,y+12,2+row*21,58,8,3,shade(c,6));for(let i=0;i<7;i++){const col=['#af9570','#637f83','#ad796b','#8c8b62','#a899af'][i%5];if(type==='books')box(x+4+i*7,y+14,5+row*21,4,5,10+(i*7)%6,col);else box(x+4+i*7,y+14,5+row*21,5,6,6+(i%3)*2,col)}}box(x-1,y-1,44,60,18,3,shade(c,10));
    }
    function windowBack(a,x=95,width=55){const y=a.y+5,z=22,h=40;iso([[a.x+x,y,z],[a.x+x+width,y,z],[a.x+x+width,y,z+h],[a.x+x,y,z+h]],'#b4a184',ink);iso([[a.x+x+3,y-1,z+3],[a.x+x+width-3,y-1,z+3],[a.x+x+width-3,y-1,z+h-3],[a.x+x+3,y-1,z+h-3]],'#213d50');iline([[a.x+x+width/2,y-2,z+2],[a.x+x+width/2,y-2,z+h-2]],'#9b9e94',3);iline([[a.x+x,y-2,z+20],[a.x+x+width,y-2,z+20]],'#9b9e94',2);const q=p(a.x+x+width-12,y-2,z+h-10);rect(q[0],q[1],3,3,'#dddbc0');for(let i=0;i<5;i++){const s=p(a.x+x+7+i*9,y-2,z+12+(i*7)%20);rect(s[0],s[1],1,1,'#9dadac')}box(a.x+x-3,y,18,width+6,8,4,'#829085')}
    function wall(a){
      box(a.x-5,a.y-5,0,191,5,70,a.wall);box(a.x-5,a.y,0,5,174,70,shade(a.wall,-8));
      box(a.x-6,a.y-6,70,193,7,3,a.trim);box(a.x-6,a.y-1,70,7,177,3,a.trim);
      for(let z=17;z<67;z+=17){iline([[a.x,a.y+.5,z],[a.x+184,a.y+.5,z]],shade(a.wall,-7));for(let k=0;k<6;k++){const x=a.x+14+k*32+(z%2?8:0);iline([[x,a.y+.5,z],[x,a.y+.5,z-16]],shade(a.wall,-7))}iline([[a.x+.5,a.y,z],[a.x+.5,a.y+174,z]],shade(a.wall,-15))}
      box(a.x,a.y+1,0,184,3,5,shade(a.wall,-17));box(a.x+1,a.y,0,3,173,5,shade(a.wall,-22));
      box(a.x-2,a.y+171,0,8,8,51,a.trim);
      windowBack(a);
    }
    function wallArt(a,type){const q=p(a.x+46,a.y+3,47);ctx.save();ctx.transform(.86,.43,0,1,q[0],q[1]);rect(-22,-19,44,29,'#3b4848');rect(-20,-17,40,25,type==='map'?'#b8b08b':'#597879');if(type==='map'){line([[-18,-7],[-6,-12],[3,-4],[15,-11]],'#798c78',2);line([[-9,5],[-3,-5],[9,0]],'#7d977a',3)}else{for(let i=0;i<3;i++){line([[-15,-11+i*7],[12,-11+i*7]],'#9bbaa9');rect(-13+i*11,-14,3,3,'#c5cba9')}}ctx.restore()}
    function charStart(x,y,z=0){shadow(x,y,17);const q=p(x,y,z);ctx.save();ctx.translate(Math.round(q[0]),Math.round(q[1]));return q}
    // Eyes carry most of the character at this size: a dark oval plus one bright
    // pixel of catchlight. Without the catchlight every face reads as dead.
    function eye(x,y,w=3,h=4,c='#16242b'){rect(x,y,w,h,c);rect(x,y,1,1,'#f2ead0')}
    function blush(x,y,c='#d98a7e'){rect(x,y,4,2,c)}

    /* Goop - moss-green slime, brass goggles pushed up on the brow, leather
       apron, hammer. Reference: GOOP / BUILD sheet. */
    function goop(a,active){
      const tt=active?t:0,bob=active?Math.sin(tt*5)*1.2:0;
      charStart(a.x+91,a.y+118);ctx.translate(0,bob);
      const dark='#22301f',mid='#7fa254',lit='#a3c473',hi='#c2dd92';
      // Blob body: wide base, soft shoulders, a crown that leans into the swing.
      poly([[-19,1],[-21,-9],[-19,-19],[-15,-28],[-8,-34],[3,-36],[12,-31],[16,-22],[19,-12],[18,1]],dark);
      poly([[-16,0],[-18,-9],[-16,-19],[-12,-27],[-6,-32],[2,-33],[10,-28],[13,-20],[16,-11],[15,0]],mid);
      poly([[-12,-6],[-14,-18],[-9,-28],[-1,-31],[5,-28],[6,-20],[2,-12]],lit);
      poly([[-8,-22],[-9,-27],[-4,-30],[0,-28],[-2,-23]],hi);
      // Leather apron, sitting LOW so the body still reads green.
      poly([[-12,1],[-11,-11],[10,-11],[11,1]],'#6d4a33');
      poly([[-10,0],[-9,-9],[8,-9],[9,0]],'#89603f');
      line([[-6,-11],[-2,-19]],'#6d4a33',2);line([[5,-11],[2,-19]],'#6d4a33',2);
      rect(-2,-15,4,3,'#c9a35f');
      // Brass goggles PUSHED UP on the brow - the sheet keeps the eyes and the
      // smile clear beneath them. Goggles over the eyes read as sunglasses, and
      // the whole character turns grumpy.
      rect(-12,-32,24,3,'#7a5a33');
      for(const gx of [-11,3]){
        rect(gx,-36,8,8,'#c9a35f');rect(gx+1,-35,6,6,'#5f4526');
        rect(gx+2,-34,4,4,'#3d6068');rect(gx+2,-34,2,2,'#9ccdd1');
      }
      eye(-7,-26,4,5);eye(4,-26,4,5);
      poly([[-4,-18],[4,-18],[0,-14]],'#3d5133');
      rect(-9,-20,3,2,'#6f9350');rect(7,-20,3,2,'#6f9350');
      // Hammer arm: wind up, strike, recover - the sheet's own sequence.
      const cycle=(tt%1.2)/1.2,angle=active?(cycle<.7?-1.5+cycle*2:.8-(cycle-.7)*4):.8;
      ctx.save();ctx.translate(15,-16);ctx.rotate(angle);
      rect(0,-3,7,6,mid);
      rect(4,-2,18,4,lit);
      rect(20,-3,4,6,'#8a6a3d');rect(23,-10,12,18,'#3a4347');
      rect(24,-9,10,7,'#9fb0aa');rect(24,-1,10,8,'#6d817d');
      ctx.restore();ctx.restore();
      if(active&&cycle>.65&&cycle<.84){
        const q=p(a.x+125,a.y+105,28);
        for(let k=0;k<6;k++){const ang=k*1.05,d=6+(cycle-.65)*72;
          rect(q[0]+Math.cos(ang)*d,q[1]+Math.sin(ang)*d-4,2,2,k%2?'#ffe9a8':'#e8944f')}
      }
    }

    /* Iris - ivory owl in a lilac cloak, raising a crystal to the lamp.
       Reference: IRIS / CRITIQUE sheet. */
    function iris(a,active){
      const lift=active?Math.sin(t*1.8)*2.4:0;
      charStart(a.x+96,a.y+111);
      const cloak='#8b7fa6',cloakLit='#a99cc2',down='#efe9dc',downShade='#cfc6bd';
      poly([[-16,1],[-14,-17],[-9,-27],[8,-27],[14,-16],[17,1]],'#4a4257');
      poly([[-13,0],[-12,-16],[-7,-24],[7,-24],[12,-15],[14,0]],cloak);
      poly([[-9,0],[-8,-15],[0,-20],[6,-15],[7,0]],down);
      poly([[-6,-4],[-5,-13],[1,-16],[4,-12],[4,-4]],'#fffaf0');
      for(let i=0;i<3;i++)line([[-6+i*4,-6],[-4+i*4,-2]],downShade,1);
      poly([[-13,-16],[-15,-8],[-11,-6]],cloakLit);
      rect(-2,-22,5,4,'#c9a35f');rect(-1,-21,3,2,'#8e6f3d');
      // Head: round skull, ear tufts, big eyes, small ochre beak.
      poly([[-11,-23],[-13,-33],[-8,-38],[-4,-34],[3,-34],[7,-38],[12,-33],[10,-23]],down,'#b9b0a6');
      poly([[-10,-31],[-6,-35],[0,-33],[-2,-26]],'#fffaf0');
      eye(-7,-32,4,5);eye(3,-32,4,5);
      poly([[-2,-27],[2,-27],[0,-23]],'#c98f4a');
      poly([[-13,-34],[-10,-39],[-8,-34]],down);poly([[7,-34],[10,-39],[12,-34]],down);
      // The crystal only glows while a critique is actually running.
      line([[10,-18],[20,-24-lift],[25,-36-lift]],cloakLit,5);
      rect(21,-40-lift,7,6,down);
      if(active){
        poly([[25,-52-lift],[31,-45-lift],[26,-35-lift],[20,-43-lift]],'#dcd9f2','#fff6d0');
        line([[25,-51-lift],[25,-36-lift]],'#fbf3c8');
        const g=ctx.createRadialGradient(25,-43-lift,0,25,-43-lift,26);
        g.addColorStop(0,'#e6dfff40');g.addColorStop(1,'#e6dfff00');
        ellipse(25,-43-lift,26,26,g);
      } else {
        poly([[24,-45-lift],[28,-41-lift],[25,-36-lift],[21,-40-lift]],'#b9b5cc','#d8d3e8');
      }
      ctx.restore();
    }

    /* Rook - slate raven in a waistcoat over a white shirt, ochre beak, satchel.
       Reference: ROOK / RANK sheet. */
    function rook(a,active){
      charStart(a.x+90,a.y+116);
      const b=active?Math.sin(t*2)*1.2:0;ctx.translate(0,b);
      const feather='#1d2833',sheen='#2f4154',vest='#4d6480',vestLit='#63809e',shirt='#e3e6e4';
      rect(-9,0,6,3,'#c9a35f');rect(4,0,6,3,'#c9a35f');
      poly([[-14,1],[-13,-22],[-7,-31],[9,-29],[13,-12],[16,1]],feather);
      poly([[13,-10],[20,-4],[16,2]],sheen);
      poly([[-9,0],[-9,-23],[-2,-26],[7,-23],[11,0]],vest);
      poly([[-6,-1],[-6,-21],[0,-24],[2,-21],[1,-1]],shirt);
      poly([[-9,-14],[-6,-22],[-4,-14]],vestLit);
      for(let i=0;i<3;i++)rect(2,-19+i*5,2,2,'#d9c489');
      poly([[-8,-22],[-12,-30],[-4,-35],[7,-34],[12,-28],[10,-21],[1,-18]],feather,'#0f171d');
      poly([[-6,-29],[-1,-33],[3,-30],[0,-25]],sheen);
      eye(0,-31,4,4);
      poly([[9,-30],[22,-26],[10,-21]],'#d6a94e');poly([[9,-28],[19,-26],[10,-24]],'#b88a34');
      rect(-14,-13,7,9,'#7b5a37');rect(-13,-12,5,3,'#a5813f');
      const reach=active?Math.sin(t*2.2)*4:0;
      line([[-4,-17],[5,-9+reach],[12,-13+reach]],sheen,4);
      ctx.restore();
    }

    /* Vera - ginger fox in a teal coat, white muzzle and chest, brush tail.
       Reference: VERA / ANALYSE sheet. */
    function vera(a,active){
      charStart(a.x+102,a.y+127);
      const fur='#d98c4a',furLit='#eda862',cream='#f2e3c8',coat='#2f5f5c',coatLit='#41807a';
      const sway=active?Math.sin(t*1.5)*4:0;
      poly([[-16,-2],[-24,-8-sway*.4],[-30,-4-sway*.5],[-27,3],[-19,4]],fur,'#8d5a2e');
      poly([[-26,-4-sway*.5],[-31,-3-sway*.5],[-28,3],[-24,2]],cream);
      poly([[-12,2],[-13,-19],[-7,-27],[8,-27],[13,-17],[13,2]],coat,'#1c3d3b');
      poly([[-9,1],[-10,-17],[-5,-24],[-2,-17],[-3,1]],coatLit);
      poly([[-5,-19],[0,-23],[5,-19],[4,-6],[-4,-6]],cream);
      rect(-8,-24,16,3,cream);
      for(let i=0;i<2;i++)rect(-1,-15+i*5,2,2,'#c9a35f');
      // Head: ginger skull, cream inner ears, white muzzle, green eyes.
      poly([[-10,-22],[-12,-31],[-8,-40],[-3,-32],[4,-32],[9,-40],[12,-31],[10,-22]],fur,'#8d5a2e');
      poly([[-9,-32],[-7,-38],[-4,-33]],cream);poly([[6,-33],[9,-38],[10,-32]],cream);
      poly([[-8,-30],[-2,-33],[2,-30],[-1,-24]],furLit);
      poly([[-6,-27],[6,-27],[4,-21],[-4,-21]],cream);
      eye(-7,-31,3,4,'#20463a');eye(4,-31,3,4,'#20463a');
      rect(-1,-25,3,2,'#3b3128');
      const trace=active?Math.sin(t*2)*6:0;
      line([[9,-16],[19,-22]],coatLit,5);
      line([[18,-22],[30+trace,-34-trace*.4]],'#d9c39a',2);
      ctx.restore();
    }

    /* Lil Claw - coral crab in a teal dispatch cap with a gold anchor.
       Reference: LIL CLAW / ROUTE sheet. */
    function claw(a,active){
      charStart(a.x+98,a.y+115);
      const b=active?Math.sin(t*3)*1:0;ctx.translate(0,b);
      const shell='#d9634f',shellLit='#ef8a6d',shellDark='#8e3a2f',cap='#2f6f83',capLit='#3f8ca3';
      for(const side of [-1,1])for(let i=0;i<3;i++)
        line([[side*9,-6+i*3],[side*(17+i*2),-7+i*5],[side*(17+i*2),-3+i*5]],shellDark,3);
      poly([[-13,0],[-16,-9],[-11,-20],[10,-20],[15,-9],[13,0]],shellDark);
      poly([[-11,-1],[-13,-9],[-9,-18],[8,-18],[12,-9],[10,-1]],shell);
      poly([[-7,-4],[-9,-11],[-5,-16],[1,-16],[2,-9],[-1,-4]],shellLit);
      rect(-8,-23,4,6,shell);rect(5,-23,4,6,shell);
      eye(-8,-25,4,4);eye(5,-25,4,4);
      poly([[-8,-1],[-7,-12],[7,-12],[8,-1]],'#e8dcc0');
      rect(-2,-9,4,5,'#3f5a63');rect(-3,-8,6,2,'#3f5a63');
      // Dispatch cap: brim, crown, gold anchor badge.
      poly([[-13,-27],[9,-29],[14,-25],[-11,-23]],cap,'#1d4a58');
      poly([[-10,-29],[-8,-34],[4,-35],[8,-30]],capLit,'#1d4a58');
      rect(-2,-33,4,4,'#d9b559');rect(-1,-30,2,2,'#d9b559');
      const move=active?Math.sin(t*4)*7:0;
      line([[-12,-11],[-23,-19-move]],shell,5);
      poly([[-25,-17-move],[-32,-24-move],[-25,-31-move],[-25,-24-move],[-19,-28-move],[-17,-23-move]],shellLit,shellDark);
      line([[12,-11],[23,-19+move]],shell,5);
      poly([[20,-21+move],[22,-29+move],[27,-26+move],[32,-30+move],[32,-21+move],[25,-17+move]],shellLit,shellDark);
      if(active){rect(24,-28+move,13,10,'#efe7cc');line([[26,-25+move],[33,-25+move]],'#8e9a90');line([[26,-22+move],[31,-22+move]],'#8e9a90')}
      ctx.restore();
    }

    /* Pip - cream spirit in a red scarf, holding one page by the hearth.
       Reference: PIP / QUIET sheet. Pip's lane is QUIET: she only ever breathes. */
    function pip(a,active){
      charStart(a.x+111,a.y+119);
      const breath=Math.sin(t*1.2)*.7;ctx.translate(0,breath);
      const body='#f0e6c9',bodyLit='#fdf6e0',bodyDark='#b9ad8c',scarf='#b3473a',scarfLit='#cf6050';
      poly([[-14,1],[-17,-9],[-15,-24],[-9,-31],[6,-31],[13,-24],[16,-9],[13,1]],bodyDark);
      poly([[-12,0],[-15,-9],[-13,-23],[-7,-29],[4,-29],[10,-23],[13,-9],[11,0]],body);
      poly([[-9,-6],[-11,-19],[-6,-26],[0,-27],[0,-16],[-3,-7]],bodyLit);
      // The woven cushion she sits in.
      poly([[-16,2],[16,2],[13,6],[-13,6]],'#8d7c52');
      for(let i=-14;i<14;i+=5)rect(i,2,3,3,'#a8945f');
      // Face is the biggest thing on her: big eyes high, blush under them.
      // The eyes close on the slow idle beat - she is the QUIET lane.
      const shut=!active&&Math.sin(t*.9)>.93;
      if(shut){line([[-9,-22],[-4,-22]],'#5d5238',2);line([[3,-22],[8,-22]],'#5d5238',2)}
      else{eye(-9,-25,4,5);eye(4,-25,4,5)}
      blush(-11,-19,'#e09a8c');blush(8,-19,'#e09a8c');
      poly([[-3,-19],[3,-19],[0,-16]],'#a08a6a');
      // Scarf: a thin band under the chin with one tail, not a bandage.
      poly([[-12,-14],[11,-14],[11,-10],[-12,-10]],scarf);
      rect(-12,-13,23,1,scarfLit);
      poly([[5,-11],[10,-11],[9,-2],[5,-3]],scarf);rect(5,-7,5,1,scarfLit);
      // One page, held small and low.
      rect(-7,-8,13,6,'#fbf5e4');rect(-6,-7,11,1,'#c3bda6');rect(-6,-5,8,1,'#c3bda6');
      ctx.restore();
    }
    function scales(x,y,z,active){const q=p(x,y,z);const swing=active?Math.sin(t*2)*.13:0;line([[q[0],q[1]],[q[0],q[1]-38]],'#cfb982',3);rect(q[0]-12,q[1]-1,24,3,'#bba46e');ellipse(q[0],q[1]-39,3,3,'#ddd09a');const left=[q[0]-27*Math.cos(swing),q[1]-32-27*Math.sin(swing)],right=[q[0]+27*Math.cos(swing),q[1]-32+27*Math.sin(swing)];line([left,right],'#dcc58e',3);for(let q1 of [left,right]){line([q1,[q1[0]-9,q1[1]+20]],'#b49d6b');line([q1,[q1[0]+9,q1[1]+20]],'#b49d6b');poly([[q1[0]-13,q1[1]+20],[q1[0]+13,q1[1]+20],[q1[0]+8,q1[1]+25],[q1[0]-8,q1[1]+25]],'#b19c73',ink);rect(q1[0]-5,q1[1]+12,10,8,'#9bb3b6');rect(q1[0]-3,q1[1]+10,6,2,'#d0d5bd')}}
    function fireplace(a){const x=a.x+32,y=a.y+13;box(x,y,0,53,20,54,'#7b7970');box(x-5,y-4,54,63,29,6,'#9a9580');box(x+8,y+20,0,37,2,38,'#323935');box(x-3,y+18,0,60,14,5,'#8c8069');const q=p(x+28,y+23,5);const g=ctx.createRadialGradient(q[0],q[1],0,q[0],q[1],65);g.addColorStop(0,'#f5b76d3f');g.addColorStop(1,'#f5b76d00');ellipse(q[0],q[1]+10,65,42,g);line([[q[0]-14,q[1]],[q[0]+12,q[1]+6]],'#614e3b',5);line([[q[0]-10,q[1]+6],[q[0]+12,q[1]-1]],'#9c6944',4);for(let i=0;i<3;i++){const f=3+Math.sin(t*6+i*1.8)*3,xx=q[0]+(i-1)*9;poly([[xx-6,q[1]],[xx-5,q[1]-9],[xx,q[1]-22-f],[xx+3,q[1]-12],[xx+7,q[1]-4],[xx+4,q[1]+2]],'#df9561');poly([[xx-3,q[1]],[xx,q[1]-12-f],[xx+4,q[1]-2]],'#f1ce88')}
      jar(x+4,y+7,60,'#a6a58b');const clock=p(x+35,y+5,69);ellipse(clock[0],clock[1],8,8,'#cabb91');line([[clock[0],clock[1]-5],[clock[0],clock[1]],[clock[0]+4,clock[1]+2]],'#596561');
    }

return {setTime(value){t=value},poly,iso,line,iline,rect,shade,box,ellipse,shadow,floorRect,table,book,floorPage,plant,jar,lamp,rug,shelf,windowBack,wallArt,scales,fireplace,characters:{slime:goop,owl:iris,raven:rook,fox:vera,crab:claw,spirit:pip}};
}


function createWorld(canvas,labelLayer,onSelect){
 const ctx=canvas.getContext('2d');const art=createArt(ctx,project);
 let model,rooms=[],selected='goop',motion=true,time=0,last=0,transfer=null,showRoute=false,items=[],serial=0,view={scale:1,tx:0,ty:0},screen={w:1000,h:620},labelKey='',mobile=false;
 let presentation={assembly:1,drift:0},roomIndex=-1,visible=true,lastPaint=0;
 const add=(x,y,fn,layer=0,id)=>items.push({x,y,fn,layer,roomIndex,id:id||String(serial++).padStart(7,'0')});
 const cube=(x,y,z,dx,dy,dz,c,layer=0)=>add(x+dx/2,y+dy/2,()=>art.box(x,y,z,dx,dy,dz,c),layer);
 function architecture(a){
  const x=a.x,y=a.y,g=GEOMETRY;
  // Rear walls are split at the doorway, and into short draw units.
  const rearHeight=a.bank===1?18:59;
  for(const [lo,hi] of (a.bank===1?[[0,80],[116,g.roomW]]:[[0,g.roomW]]))for(let k=lo;k<hi;k+=14){const width=Math.min(14,hi-k);cube(x+k,y-4,0,width,4,rearHeight,a.wall);cube(x+k,y-5,rearHeight,width,6,3,a.trim,2);}
  // Left boundary: tall at the back, cut down toward the viewer.
  for(let k=0;k<g.roomH;k+=14){const height=k<67?59:18;cube(x-4,y+k,0,4,Math.min(14,g.roomH-k),height,art.shade(a.wall,-9));cube(x-5,y+k,height,6,Math.min(14,g.roomH-k),3,a.trim,2);}
  // The near edge is a cutaway wall, interrupted by a real door in bank 0.
  for(const [lo,hi] of (a.bank===0?[[0,80],[116,g.roomW]]:[[0,g.roomW]]))for(let k=lo;k<hi;k+=14){const width=Math.min(14,hi-k);cube(x+k,y+g.roomH,0,width,4,10,art.shade(a.wall,-13));cube(x+k,y+g.roomH,10,width,4,2,a.trim,2);}
  const d=a.door,passing=transfer&&(transfer.from===a.id||transfer.to===a.id);
  let openness=0;
  if(passing){const q=alongRoute(transfer.route,transfer.progress),distance=Math.hypot(q.x-d.x,q.y-d.y);openness=Math.max(0,Math.min(1,(65-distance)/30));}
  const angle=openness*Math.PI*.48,sign=a.bank===0?-1:1;
  // Jambs are separate depth items; the parcel can pass between them.
  cube(d.x-20,d.y-3,0,5,7,49,a.trim,5);cube(d.x+15,d.y-3,0,5,7,49,a.trim,5);
  cube(d.x-21,d.y-3,49,42,7,5,a.trim,5);
  const hx=d.x-15,hy=d.y,ex=hx+30*Math.cos(angle),ey=hy+sign*30*Math.sin(angle);
  add((hx+ex)/2,(hy+ey)/2,()=>{
    art.iso([[hx,hy,1],[ex,ey,1],[ex,ey,46],[hx,hy,46]],'#957b58','#433f35');
    art.iline([[hx,hy,45],[ex,ey,45]],'#c4ad79',2);
    for(let k=1;k<4;k++){const u=k/4;art.iline([[hx+(ex-hx)*u,hy+(ey-hy)*u,3],[hx+(ex-hx)*u,hy+(ey-hy)*u,44]],'#705d44');}
    const knob=project(hx+(ex-hx)*.8,hy+(ey-hy)*.8,23);art.rect(knob.x,knob.y,3,3,'#e2c98c');
  },3,`door-${a.id}`);
  add(d.x,d.y,()=>{art.floorRect(d.x-17,d.y-6,34,12,'#b3a17d');},-10);
  if(a.state==='blocked'){
    // Persistent physical hazard board; no reliance on a faint glow.
    add(d.x+28,d.y+5,()=>{
      const q=project(d.x+28,d.y+5,32);art.rect(q.x-2,q.y,4,31,'#a88862');
      art.poly([[q.x-10,q.y-21],[q.x+10,q.y-21],[q.x+15,q.y-16],[q.x+15,q.y+2],[q.x+10,q.y+7],[q.x-10,q.y+7],[q.x-15,q.y+2],[q.x-15,q.y-16]],'#ecb375','#533b2c');
      art.rect(q.x-2,q.y-15,4,12,'#523b31');art.rect(q.x-2,q.y+1,4,3,'#523b31');
    },9);
  }
 }
 function props(a){const x=a.x,y=a.y;
   add(x+38,y+17,()=>{art.shelf(x+7,y+8,art.shade(a.trim,-24),a.station==='route'?'parts':'books');art.book(x+14,y+12,47,'#ab9d7c',20,12)});
   if(a.bank===0)add(x+139,y,()=>art.windowBack(a,111,56),1);
   add(x+172,y+58,()=>art.plant(x+171,y+58));
   art.rug(x+48,y+58,115,84,a.station==='critique'?'#81768b':art.shade(a.floor,13));
   const active=a.state==='working',station=a.station;
   if(station==='build'){
     add(x+116,y+86,()=>{art.table(x+68,y+65,93,40,27,'#a08861');art.box(x+98,y+77,29,28,19,6,'#567e83');art.floorPage(x+72,y+68,29,19,24,'#b7bd9f');art.jar(x+143,y+69,29,'#a89b7a');art.box(x+131,y+91,24,13,14,13,'#697976')});
   }else if(station==='critique'){
     add(x+118,y+90,()=>{art.box(x+110,y+84,0,17,15,30,'#77697b');art.box(x+99,y+67,30,40,35,5,'#a697aa');art.floorPage(x+104,y+72,36,29,24,'#d8d1b5')});
   }else if(station==='rank'){
     add(x+117,y+85,()=>{art.table(x+70,y+65,91,43,28,'#819093');art.scales(x+118,y+82,30,active);art.book(x+142,y+85,30,'#b4a37d');});
   }else if(station==='analyse'){
     add(x+110,y+90,()=>{art.table(x+59,y+63,99,54,27,'#a08b62');art.floorPage(x+64,y+67,29,66,42,'#b9bc96');art.iso([[x+70,y+76,30],[x+93,y+71,30],[x+99,y+86,30],[x+121,y+80,30],[x+124,y+98,30],[x+102,y+103,30],[x+83,y+93,30]],'#879b80');art.iline([[x+73,y+99,31],[x+86,y+84,31],[x+108,y+88,31],[x+121,y+73,31]],'#b58a63',2);art.book(x+135,y+69,29,'#718677',17,21);art.book(x+135,y+71,34,'#c1ac84',15,19)});
   }else if(station==='route'){
     add(x+110,y+86,()=>{art.table(x+61,y+64,99,42,28,'#b3986f');for(let i=0;i<3;i++){art.box(x+69+i*28,y+69,30,22,26,4,['#91a493','#a598aa','#ad9074'][i]);art.floorPage(x+73+i*28,y+73,35,15,19,'#d9d3b1')}});
   }else if(station==='quiet'){
     add(x+48,y+26,()=>art.fireplace(a));add(x+100,y+112,()=>{art.box(x+92,y+113,0,39,26,10,'#807e61');art.box(x+94,y+114,10,35,22,4,'#a2a080')},-1);
     add(x+62,y+109,()=>{art.table(x+48,y+99,26,26,17,'#96825b');art.jar(x+53,y+104,19,'#b1b099')});
   }
   if(station!=='quiet')add(x+166,y+77,()=>art.lamp(x+166,y+77,0,!['offline','asleep'].includes(a.state)));
   const fn=art.characters[a.sprite];const foot={slime:[91,118],owl:[96,111],raven:[90,116],fox:[102,127],crab:[98,115],spirit:[111,119]}[a.sprite]||[100,116];
   add(x+foot[0],y+foot[1],()=>{ctx.save();if(a.state==='offline')ctx.globalAlpha=.35;if(fn)fn(a,active);else{const q=project(x+100,y+116,0);art.rect(q.x-9,q.y-23,18,23,'#abb2ab');art.rect(q.x-5,q.y-18,3,3,'#343c3c');art.rect(q.x+3,q.y-18,3,3,'#343c3c');}ctx.restore()},3,`actor-${a.id}`);
 }
 function packageBays(a){const c=counts(model.packages,a.id),types=[{n:c.ready,origin:a.readyBay,sent:false},{n:c.sent,origin:a.sentBay,sent:true}];
   for(const type of types){const o=type.origin;
     art.floorRect(o.x-4,o.y-4,49,30,type.sent?'#687969':'#8b7b56');
     const slots=packageSlots(type.n,o);
     slots.forEach((s,i)=>add(s.x+5,s.y+5,()=>parcel(s.x,s.y,s.z,type.sent),1+i*.01,`${a.id}-${type.sent?'sent':'ready'}-${i}`));
     if(type.n>12)add(o.x+22,o.y+17,()=>{const q=project(o.x+22,o.y+17,32);ctx.font='12px sans-serif';ctx.fillStyle='#fff1c5';ctx.fillText('+'+(type.n-12),q.x-6,q.y)},20);
   }
 }
 function parcel(x,y,z=0,received=false){art.shadow(x+5,y+5,7);art.box(x,y,z,11,10,10,received?'#8fac98':'#d2b37b');art.iline([[x+5,y,z+11],[x+5,y+10,z+11]],received?'#b5d4b7':'#f0d7a0',2);if(received){const q=project(x+10,y+9,z+6);art.line([[q.x-3,q.y],[q.x-1,q.y+2],[q.x+3,q.y-2]],'#244d40',1.5)}}
 function base(){const g=GEOMETRY,maxX=Math.max(...rooms.map(a=>a.x+g.roomW)),maxY=Math.max(...rooms.map(a=>a.y+g.roomH));
   art.box(-53,-12,-19,maxX+65,maxY+24,19,'#364448');
   for(let y=-6;y<maxY+10;y+=19)for(let x=-46;x<maxX+6;x+=25)art.floorRect(x,y,24,18,((x+y)%3?'#53615c':'#58665e'));
   const aisles=[...new Set(rooms.map(a=>a.aisleY))];
   for(const y of aisles){art.floorRect(-44,y-29,maxX+49,58,'#829084');art.iline([[-42,y-23,1],[maxX+3,y-23,1]],'#a7b0a0',1);art.iline([[-42,y+23,1],[maxX+3,y+23,1]],'#a7b0a0',1);for(let x=0;x<maxX;x+=25)art.iline([[x,y-20,1],[x,y+20,1]],'#748375');}
   art.floorRect(-43,aisles[0]-27,27,aisles.at(-1)-aisles[0]+54,'#829084');
   for(const a of rooms){art.floorRect(a.x,a.y,g.roomW,g.roomH,a.floor);for(let yy=0;yy<g.roomH;yy+=14)for(let xx=0;xx<g.roomW;xx+=39){const off=(yy/14)%2?19:0,rx=xx+off;if(rx<g.roomW)art.floorRect(a.x+rx+.5,a.y+yy+.5,Math.min(37,g.roomW-rx-1),12,art.shade(a.floor,(xx+yy)%9-4));}
     if(a.id===selected)art.iline([[a.x+6,a.y+7,1],[a.x+188,a.y+7,1],[a.x+188,a.y+177,1],[a.x+6,a.y+177,1],[a.x+6,a.y+7,1]],'#c3d4af',2);
   }
 }
 function camera(){mobile=screen.w<620;const focus=rooms.find(a=>a.id===selected)||rooms[0],list=mobile?[focus]:rooms;
   const pts=list.flatMap(a=>[project(a.x-24,a.y-12,90),project(a.x+220,a.y-12,90),project(a.x-24,a.y+210,-24),project(a.x+220,a.y+210,-24)]);
   if(!mobile)pts.push(project(-60,0,0));const minX=Math.min(...pts.map(p=>p.x)),maxX=Math.max(...pts.map(p=>p.x)),minY=Math.min(...pts.map(p=>p.y)),maxY=Math.max(...pts.map(p=>p.y));
   const s=Math.min((screen.w-28)/(maxX-minX),(screen.h-38)/(maxY-minY));view={scale:s,tx:(screen.w-(maxX-minX)*s)/2-minX*s,ty:(screen.h-(maxY-minY)*s)/2-minY*s+4};
 }
 function labels(){
   const candidates=rooms.filter(a=>!mobile||a.id===selected).map((a)=>{const q=a.bank===0?project(a.x+87,a.y+14,76):project(a.x+95,a.y+190,-3),width=a.state==='blocked'?132:96;return {id:a.id,x:q.x*view.scale+view.tx-width/2,y:q.y*view.scale+view.ty-10,w:width,h:a.state==='blocked'?43:27}});
   const placed=avoidLabelCollisions(candidates,screen.w,screen.h);
   const key=JSON.stringify([placed,rooms.map(a=>a.state),selected,mobile]);if(key===labelKey)return;labelKey=key;labelLayer.replaceChildren();
   for(const pos of placed){const a=rooms.find(a=>a.id===pos.id),button=document.createElement('button');button.type='button';button.className='room-name'+(a.state==='blocked'?' is-stuck':'');button.style.left=pos.x+'px';button.style.top=pos.y+'px';button.style.width=pos.w+'px';button.style.minHeight=pos.h+'px';button.setAttribute('aria-pressed',String(a.id===selected));button.setAttribute('aria-label',a.name+', '+a.room+', '+(a.state==='blocked'?'stuck':a.state));const title=document.createElement('span');title.textContent=a.name;button.append(title);if(a.state==='blocked'){const state=document.createElement('small');state.textContent='!  STUCK · '+a.elapsed;button.append(state)}button.onclick=()=>onSelect(a.id);labelLayer.append(button)}
 }
 function draw(){if(!model||!rooms.length)return;items=[];serial=0;camera();art.setTime(time);const ratio=canvas.width/screen.w;ctx.setTransform(ratio,0,0,ratio,0,0);ctx.fillStyle='#191f22';ctx.fillRect(0,0,screen.w,screen.h);ctx.translate(view.tx,view.ty);ctx.scale(view.scale,view.scale);ctx.imageSmoothingEnabled=false;
   base();for(const [i,a] of rooms.entries()){roomIndex=i;architecture(a);props(a);packageBays(a)}roomIndex=-1;
   if(transfer){const q=alongRoute(transfer.route,transfer.progress);if(showRoute){art.iline(transfer.route.map(p=>[p.x,p.y,1]),'#c8d8bd',2)}add(q.x,q.y,()=>parcel(q.x-5,q.y-5,3+Math.sin(time*5)*.8),2,'moving-package');}
   for(const item of sortDrawables(items)){
    // Presentation lift never changes ground-depth keys or the parcel route.
    const local=Math.max(0,Math.min(1,(presentation.assembly*1.55-Math.max(0,item.roomIndex)*.10)/.95));
    const lift=item.roomIndex<0?0:Math.pow(1-local,3)*110;
    ctx.save();ctx.translate(0,-lift);ctx.globalAlpha=item.roomIndex<0?1:.12+.88*local;item.fn();ctx.restore();
   }labels();labelLayer.classList?.toggle('is-assembling',presentation.assembly<1);
 }
 function resize(){const bounds=canvas.parentElement.getBoundingClientRect();screen.w=Math.max(280,bounds.width);screen.h=screen.w<620?350:Math.max(440,screen.w*.59);const dpr=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(screen.w*dpr);canvas.height=Math.round(screen.h*dpr);canvas.style.height=screen.h+'px';draw()}
 const observer=new ResizeObserver(resize);observer.observe(canvas.parentElement);
 canvas.addEventListener('click',e=>{const r=canvas.getBoundingClientRect(),q=unproject((e.clientX-r.left-view.tx)/view.scale,(e.clientY-r.top-view.ty)/view.scale);const hit=rooms.find(a=>q.x>=a.x&&q.x<=a.x+GEOMETRY.roomW&&q.y>=a.y&&q.y<=a.y+GEOMETRY.roomH);if(hit)onSelect(hit.id)});
 const visibilityObserver=new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;if(visible)draw()});visibilityObserver.observe(canvas);
 let raf;function frame(now){if(last&&motion&&visible&&!document.hidden)time+=Math.min((now-last)/1000,.08);last=now;if(motion&&visible&&!document.hidden&&now-lastPaint>=1000/30){draw();lastPaint=now}if(canvas.isConnected)raf=requestAnimationFrame(frame);else{observer.disconnect();visibilityObserver.disconnect()}}raf=requestAnimationFrame(frame);
 return {setPresentation(value){Object.assign(presentation,value);draw()},update(value,agentId){model=value;rooms=layoutAgents(value.agents);selected=agentId;draw()},setMotion(value){motion=value},setTransfer(value){if(value){const from=rooms.find(a=>a.id===value.from),to=rooms.find(a=>a.id===value.to);transfer={...value,route:routeBetween(from,to)}}else transfer=null;draw()},showRoute(value){showRoute=value;draw()},destroy(){cancelAnimationFrame(raf);observer.disconnect();visibilityObserver.disconnect()},resize};
}


export { createWorld, createArt };
