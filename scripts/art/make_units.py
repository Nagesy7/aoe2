# Inu Verse unit sprite generator (vendored from /workspace/inu-art/empires/make_units.py; bases from inu-art/verse-outfits).
# Usage: python3 scripts/art/make_units.py [id,id,...]  -> art/units/<id>.png + _team.png, merges art/manifest.json
import json, math
from PIL import Image, ImageDraw, ImageEnhance
V='/workspace/inu-art/verse-outfits/'
S=6  # work scale
def base(col,view,i):
    return Image.open(f'{V}{col}/base_{view}.png').convert('RGBA').crop((i*124,0,124*(i+1),228))
U={ # id: base colour, frame size, kind, weapon
 'villager':('golden',(48,48),'inf','hammer'),
 'militia':('dark',(48,48),'inf','sword'),
 'spearman':('cream',(48,48),'inf','spear'),
 'archer':('tan',(48,48),'inf','bow'),
 'crossbowman':('red',(48,48),'inf','xbow'),
 'scout_cavalry':('cream',(64,56),'cav','sword'),
 'knight':('red',(64,56),'cav','lance'),
 'monk':('cream',(48,48),'inf','staff'),
 'trebuchet':('golden',(64,64),'treb',None),
 # upgraded / clan-unique lines (own sprites, same Inu Verse pipeline)
 'halberd_pup':('cream',(48,48),'inf','halberd'),
 'blade_paw':('dark',(48,48),'inf','katana'),
 'swift_rider':('gray',(64,56),'cav','sword'),
 'red_fang':('red',(48,48),'inf','sword'),
 'akita_guardian':('red',(48,48),'inf','sword'),
 'kishu_longbow':('cream',(48,48),'inf','longbow'),
 'boar_rider':('tan',(64,56),'cav','sword'),
 'frost_guard':('gray',(48,48),'inf','spear'),
 'brindle_striker':('dark',(48,48),'inf','dual')}
U['crossbowman']=('red',(48,48),'inf','longbow')  # Longbow Pup: a real longbow, not a crossbow
# villager work sheets: one per tool; 'attack' columns are the work motion (chop / mine / pick / hoe / stab / cast)
for _t in ('axe','pick','basket','hoe','knife','spear','net','none'): U['villager_'+_t]=('golden',(48,48),'inf',_t)
MOUNT={'scout_cavalry':(138,106,58),'knight':(74,58,48),'swift_rider':(196,178,150),'boar_rider':(84,60,44)}
OUT=(28,20,14)
def sh(c,f): return tuple(max(0,min(255,int(v*f))) for v in c[:3])
def thick(d,p,q,w,c):
    d.line([p,q],fill=OUT,width=w+6); d.line([p,q],fill=c,width=w)
def weapon(d,kind,hx,hy,ang,flip):
    a=math.radians(ang); ux,uy=math.cos(a)*flip,-math.sin(a)
    L={'hammer':80,'sword':95,'spear':170,'lance':190,'staff':150,'bow':0,'xbow':0,'halberd':180,'katana':110,'axe':80,'pick':80,'hoe':110,'net':120,'knife':40}.get(kind,0)
    if kind=='none': return
    if kind=='halberd':
        p=(hx-ux*30,hy-uy*30); q=(hx+ux*L,hy+uy*L); thick(d,p,q,9,(120,84,44)); px,py=-uy,ux
        d.polygon([(q[0]+ux*30,q[1]+uy*30),(q[0]+px*10,q[1]+py*10),(q[0]-px*10,q[1]-py*10)],fill=(214,220,230),outline=OUT)
        b0=(q[0]-ux*10,q[1]-uy*10); d.polygon([b0,(b0[0]+px*34-ux*6,b0[1]+py*34-uy*6),(b0[0]+px*30-ux*40,b0[1]+py*30-uy*40),(b0[0]-ux*34,b0[1]-uy*34)],fill=(200,206,216),outline=OUT,width=3)
        return
    if kind=='katana':
        thick(d,(hx-ux*10,hy-uy*10),(hx+ux*24,hy+uy*24),9,(40,30,40)); px,py=-uy*12,ux*12
        thick(d,(hx+ux*22-px,hy+uy*22-py),(hx+ux*22+px,hy+uy*22+py),7,(200,160,60))
        q=(hx+ux*L,hy+uy*L); m=(hx+ux*(L*0.6)+px*0.5,hy+uy*(L*0.6)+py*0.5); d.line([(hx+ux*24,hy+uy*24),m,q],fill=OUT,width=14,joint='curve'); d.line([(hx+ux*24,hy+uy*24),m,q],fill=(226,232,240),width=8,joint='curve'); return
    if kind=='dual':
        for k,off in ((1,0),(-1,26)):
            a2=math.radians(ang+off); vx,vy=math.cos(a2)*flip,-math.sin(a2)
            thick(d,(hx,hy+off*0.6),(hx+vx*16,hy+off*0.6+vy*16),8,(90,60,30)); thick(d,(hx+vx*16,hy+off*0.6+vy*16),(hx+vx*62,hy+off*0.6+vy*62),9,(220,226,234))
        return
    if kind in('axe','pick','hoe','net','knife'):
        q=(hx+ux*L,hy+uy*L); px,py=-uy,ux
        if kind=='knife': thick(d,(hx,hy),(hx+ux*14,hy+uy*14),8,(90,60,30)); thick(d,(hx+ux*14,hy+uy*14),q,8,(220,226,234)); return
        thick(d,(hx-ux*8,hy-uy*8),q,9,(140,96,48))
        if kind=='axe': d.polygon([(q[0]-ux*6,q[1]-uy*6),(q[0]+px*30-ux*12,q[1]+py*30-uy*12),(q[0]+px*34+ux*10,q[1]+py*34+uy*10),(q[0]+ux*6,q[1]+uy*6)],fill=(196,202,212),outline=OUT,width=3)
        if kind=='pick': thick(d,(q[0]+px*34+ux*10,q[1]+py*34+uy*10),(q[0]-px*34+ux*10,q[1]-py*34+uy*10),9,(150,156,168))
        if kind=='hoe': thick(d,(q[0],q[1]),(q[0]+px*26-ux*8,q[1]+py*26-uy*8),10,(150,156,168))
        if kind=='net':
            c=(q[0]+ux*20,q[1]+uy*20); d.ellipse([c[0]-26,c[1]-22,c[0]+26,c[1]+22],outline=OUT,width=7); d.ellipse([c[0]-26,c[1]-22,c[0]+26,c[1]+22],outline=(196,160,96),width=4)
            for k in range(-2,3): d.line([(c[0]+k*9,c[1]-20),(c[0]+k*9,c[1]+20)],fill=(235,235,225),width=2); d.line([(c[0]-24,c[1]+k*8),(c[0]+24,c[1]+k*8)],fill=(235,235,225),width=2)
        return
    if kind=='basket':
        d.rectangle([hx-26,hy-8,hx+26,hy+30],fill=(176,132,70),outline=OUT,width=4)
        for k in range(3): d.line([(hx-24,hy+2+k*10),(hx+24,hy+2+k*10)],fill=(140,100,50),width=3)
        for bx,by in ((-14,-12),(0,-16),(14,-12),(-6,-6),(8,-6)): d.ellipse([hx+bx-7,hy+by-7,hx+bx+7,hy+by+7],fill=(196,32,58),outline=OUT,width=2)
        d.arc([hx-24,hy-40,hx+24,hy+4],180,360,fill=OUT,width=5); return
    if kind in('hammer','sword','spear','lance','staff'):
        tail=-30 if kind in('spear','lance','staff') else -8
        p=(hx+ux*tail,hy+uy*tail); q=(hx+ux*L,hy+uy*L)
        if kind=='sword':
            thick(d,(hx,hy),(hx+ux*20,hy+uy*20),10,(90,60,30)); thick(d,(hx+ux*20,hy+uy*20),q,12,(214,220,230))
            px,py=-uy*16,ux*16; thick(d,(hx+ux*20-px,hy+uy*20-py),(hx+ux*20+px,hy+uy*20+py),8,(232,184,72))
        else:
            thick(d,p,q,9,(140,96,48))
            if kind=='hammer':
                px,py=-uy*22,ux*22; thick(d,(q[0]-px,q[1]-py),(q[0]+px,q[1]+py),20,(120,124,134))
            if kind in('spear','lance'):
                px,py=-uy*10,ux*10
                d.polygon([(q[0]+ux*36,q[1]+uy*36),(q[0]+px,q[1]+py),(q[0]-px,q[1]-py)],fill=(214,220,230),outline=OUT)
            if kind=='staff':
                d.ellipse([q[0]-14,q[1]-14,q[0]+14,q[1]+14],fill=(255,214,90),outline=OUT,width=3)
    elif kind=='longbow':
        r=86; ext=[-90,90] if flip>0 else [90,270]
        d.arc([hx-r*0.42,hy-r,hx+r*0.42,hy+r],ext[0],ext[1],fill=OUT,width=12); d.arc([hx-r*0.42,hy-r,hx+r*0.42,hy+r],ext[0],ext[1],fill=(120,72,30),width=7)
        sx=hx-flip*ang; d.line([(hx,hy-r),(sx,hy),(hx,hy+r)],fill=(240,240,230),width=2)
        if ang>0: thick(d,(sx,hy),(hx+flip*50,hy),3,(200,170,110))
    elif kind=='bow':
        r=60; d.arc([hx-r*0.5,hy-r,hx+r*0.5,hy+r],-90 if flip>0 else 90,90 if flip>0 else 270,fill=OUT,width=11)
        d.arc([hx-r*0.5,hy-r,hx+r*0.5,hy+r],-90 if flip>0 else 90,90 if flip>0 else 270,fill=(150,96,40),width=6)
        dr=ang  # draw amount
        sx=hx-flip*dr; d.line([(hx,hy-r),(sx,hy),(hx,hy+r)],fill=(240,240,230),width=2)
        if dr>0: thick(d,(sx,hy),(hx+flip*40,hy),3,(200,170,110))
    elif kind=='xbow':
        thick(d,(hx-flip*30,hy),(hx+flip*60,hy),12,(120,80,40)); thick(d,(hx+flip*50,hy-36),(hx+flip*50,hy+36),8,(90,90,100))
        if ang>0: thick(d,(hx+flip*20,hy),(hx+flip*(60+ang),hy),3,(200,170,110))
def tabard(d,view,ox,oy,team,col):
    c=(255,255,255) if team else col
    if view=='side': box=[ox+40,oy+96,ox+92,oy+160]
    else: box=[ox+22,oy+98,ox+102,oy+160]
    d.rectangle(box,fill=c,outline=None if team else OUT,width=3)
    if not team:
        d.line([box[0],box[1]+8,box[2],box[1]+8],fill=sh(col,.7),width=4)
        d.rectangle([box[0],box[3]-10,box[2],box[3]],fill=sh(col,.75))
        if view=='front': d.line([(box[0]+box[2])//2,box[1],(box[0]+box[2])//2,box[3]],fill=sh(col,1.15),width=3)
def robe(d,view,ox,oy,team):
    c=(255,255,255) if team else (196,120,48)
    x0,x1=(ox+34,ox+96) if view=='side' else (ox+14,ox+110)
    d.polygon([(x0+10,oy+96),(x1-10,oy+96),(x1+6,oy+214),(x0-6,oy+214)],fill=c,outline=None if team else OUT)
NEUT=(150,150,160)
def helmet(d,view,ox,oy,kind):
    if kind=='knight':
        d.chord([ox+14,oy+2,ox+110,oy+90],180,360,fill=(170,176,188),outline=OUT,width=3)
        d.rectangle([ox+58,oy-20,ox+66,oy+6],fill=(200,60,50),outline=OUT)
    if kind=='militia':
        d.chord([ox+22,oy+10,ox+102,oy+80],180,360,fill=(130,110,90),outline=OUT,width=3)
    if kind=='monk':
        d.ellipse([ox+46,oy+4,ox+78,oy+20],fill=(255,214,90),outline=OUT)
    if kind=='halberd_pup':  # kabuto with crest
        d.chord([ox+18,oy+6,ox+106,oy+86],180,360,fill=(120,128,142),outline=OUT,width=3); d.rectangle([ox+14,oy+40,ox+110,oy+50],fill=(96,104,118),outline=OUT,width=2)
        d.polygon([(ox+62,oy+8),(ox+44,oy-18),(ox+62,oy-2),(ox+80,oy-18)],fill=(232,184,72),outline=OUT)
    if kind=='blade_paw':  # dark kabuto + shoulder plates
        d.chord([ox+20,oy+8,ox+104,oy+82],180,360,fill=(70,62,72),outline=OUT,width=3)
        if view!='side':
            for x0 in (ox+4,ox+92): d.rectangle([x0,oy+96,x0+28,oy+118],fill=(90,80,92),outline=OUT,width=3)
        else: d.rectangle([ox+46,oy+96,ox+86,oy+118],fill=(90,80,92),outline=OUT,width=3)
    if kind=='swift_rider':  # light cap with feather
        d.chord([ox+24,oy+12,ox+100,oy+76],180,360,fill=(150,120,80),outline=OUT,width=3); d.line([(ox+64,oy+14),(ox+92,oy-26)],fill=OUT,width=9); d.line([(ox+64,oy+14),(ox+92,oy-26)],fill=(230,90,60),width=5)
    if kind=='red_fang':  # headband with tails
        d.rectangle([ox+22,oy+44,ox+102,oy+56],fill=(200,30,40),outline=OUT,width=2); d.line([(ox+22,oy+50),(ox+4,oy+70)],fill=(200,30,40),width=6)
    if kind=='akita_guardian':  # heavy helm + round shield
        d.chord([ox+14,oy+2,ox+110,oy+90],180,360,fill=(176,150,90),outline=OUT,width=3); d.rectangle([ox+56,oy-16,ox+68,oy+6],fill=(140,30,30),outline=OUT)
        cx=ox+20 if view!='side' else ox+56; d.ellipse([cx-26,oy+104,cx+26,oy+156],fill=(120,40,30),outline=OUT,width=4); d.ellipse([cx-10,oy+120,cx+10,oy+140],fill=(232,184,72),outline=OUT,width=2)
    if kind=='kishu_longbow':  # straw hat
        d.polygon([(ox+2,oy+46),(ox+62,oy+6),(ox+122,oy+46)],fill=(214,184,110),outline=OUT); d.line([(ox+20,oy+40),(ox+104,oy+40)],fill=(170,140,70),width=3)
    if kind=='crossbowman':  # quiver strap + leather cap
        d.chord([ox+24,oy+12,ox+100,oy+78],180,360,fill=(120,80,44),outline=OUT,width=3)
    if kind=='boar_rider':
        d.chord([ox+20,oy+8,ox+104,oy+84],180,360,fill=(110,80,50),outline=OUT,width=3); d.polygon([(ox+30,oy+30),(ox+18,oy+4),(ox+42,oy+22)],fill=(240,230,210),outline=OUT); d.polygon([(ox+94,oy+30),(ox+106,oy+4),(ox+82,oy+22)],fill=(240,230,210),outline=OUT)
    if kind=='frost_guard':  # white fur hood
        d.chord([ox+12,oy+0,ox+112,oy+96],180,360,fill=(242,244,248),outline=OUT,width=3); d.ellipse([ox+10,oy+40,ox+30,oy+60],fill=(242,244,248),outline=OUT); d.ellipse([ox+94,oy+40,ox+114,oy+60],fill=(242,244,248),outline=OUT)
    if kind=='brindle_striker':  # mask band
        d.rectangle([ox+30,oy+52,ox+94,oy+62],fill=(30,24,20),outline=OUT,width=1)
    if kind.startswith('villager_'):  # straw work hat
        d.ellipse([ox+28,oy+6,ox+96,oy+30],fill=(220,190,120),outline=OUT,width=3)
def figure(uid,view,wf,pose,team,ox,oy,flip,cut=None):
    """draw infantry figure on canvas at ox,oy (base top-left). pose: weapon angle"""
    col,_,kind,wp=U[uid]
    W=Image.new('RGBA',(124,228),(0,0,0,0))
    b=base(col,view,wf)
    if uid=='monk': b=ImageEnhance.Brightness(b).enhance(1.12)
    if not team: W.alpha_composite(b)
    d=ImageDraw.Draw(W)
    if team:  # team layer: only tabard/robe pixels on top of body (occluded by nothing)
        if uid=='monk': robe(d,view,0,0,False)
        tabard(d,view,0,0,True,None)
        # mask out head region overlapping: keep as is
    else:
        if uid=='monk': robe(d,view,0,0,False)
        tabard(d,view,0,0,False,NEUT)
        helmet(d,view,0,0,uid)
    if team:
        tm=Image.new('RGBA',W.size,(0,0,0,0)); tabard(ImageDraw.Draw(tm),view,0,0,True,None); W=tm
    if cut: W=W.crop((0,0,124,cut)).crop((0,0,124,228))
    if flip<0: W=W.transpose(Image.FLIP_LEFT_RIGHT)
    return W
def frame(uid,dirn,anim,i):
    col,(fw,fh),kind,wp=U[uid]
    Cw,Ch=fw*S,fh*S
    main=Image.new('RGBA',(Cw,Ch),(0,0,0,0)); team=Image.new('RGBA',(Cw,Ch),(0,0,0,0))
    view={'S':'front','N':'back','E':'side','W':'side'}[dirn]; flip=-1 if dirn=='W' else 1
    wf={'walk':i,'idle':1 if i else 3,'attack':1,'death':1}[anim] if view!='front' or anim=='walk' else 0
    if view=='front' and anim!='walk': wf=0
    bob=(-6 if anim=='walk' and i%2 else 0)+(-3 if anim=='idle' and i==1 else 0)
    ang={'idle':[60,62],'walk':[60]*4,'attack':[110,40,-10],'death':[60]*4}[anim][i]
    if wp in('bow','xbow'): ang={'idle':[0,0],'walk':[0]*4,'attack':[0,30,60],'death':[0]*4}[anim][i]
    if wp in('spear','lance') and anim=='attack': ang=[20,5,0][i]
    if wp=='staff' and anim=='attack': ang=[80,90,100][i]
    md=ImageDraw.Draw(main)
    def put(layer_img,img,x,y): layer_img.alpha_composite(img,(int(x),int(y)))
    if kind=='inf':
        ox=(Cw-124)//2; oy=Ch-228-12+bob
        hand={'front':(ox+108,oy+150),'side':(ox+62+flip*20,oy+140),'back':(ox+14,oy+150)}[view]
        if view=='side' and flip<0: hand=(ox+62-20,oy+140)
        wflip=flip if view=='side' else (1 if view=='front' else -1)
        if view=='back': weapon(md,wp,*hand,ang,wflip)
        put(main,figure(uid,view,wf,ang,False,0,0,flip),ox,oy); put(team,figure(uid,view,wf,ang,True,0,0,flip),ox,oy)
        if view!='back': weapon(ImageDraw.Draw(main),wp,*hand,ang,wflip)
        if wp=='staff' and anim=='attack' and i>0:
            gd=ImageDraw.Draw(main); r=20+i*14; cx,cy=hand[0]+flip*0,hand[1]-150
            gd.ellipse([cx-r,cy-r,cx+r,cy+r],outline=(255,240,140),width=5)
    elif kind=='cav':
        mc=MOUNT[uid]; d=md
        gy=Ch-14; lift=bob
        legs=[0,1,2,3] 
        if view=='side':
            bx0,bx1=Cw//2-130,Cw//2+130
            if flip<0: pass
            sw=[0,30,0,-30][i] if anim=='walk' else 0
            for k,lx in enumerate((bx0+40,bx0+80,bx1-80,bx1-40)):
                s=sw if k%2 else -sw
                thick(d,(lx,gy-90+lift),(lx+s,gy),18,sh(mc,.85))
            d.ellipse([bx0,gy-170+lift,bx1,gy-80+lift],fill=mc,outline=OUT,width=4)
            hx=bx1-10 if flip>0 else bx0+10
            d.ellipse([hx-45,gy-230+lift,hx+45,gy-150+lift],fill=mc,outline=OUT,width=4)
            d.polygon([(hx-30,gy-220+lift),(hx-20,gy-260+lift),(hx,gy-226+lift)],fill=mc,outline=OUT)
            d.ellipse([hx+flip*30-10,gy-200+lift,hx+flip*30+4,gy-186+lift],fill=OUT)
            d.ellipse([hx+flip*8-6,gy-212+lift,hx+flip*8+6,gy-200+lift],fill=OUT)
            if uid=='knight': d.rectangle([bx0+50,gy-150+lift,bx1-50,gy-95+lift],fill=(200,200,210),outline=OUT,width=3)
            rx=Cw//2-62-flip*10; ry=gy-170-150+lift
        else:
            for lx in (Cw//2-50,Cw//2+30):
                thick(d,(lx,gy-80+lift),(lx,gy),20,sh(mc,.85))
            d.ellipse([Cw//2-75,gy-190+lift,Cw//2+75,gy-60+lift],fill=mc,outline=OUT,width=4)
            if view=='front':
                d.ellipse([Cw//2-50,gy-150+lift,Cw//2+50,gy-60+lift],fill=sh(mc,1.1),outline=OUT,width=4)
                d.ellipse([Cw//2-8,gy-90+lift,Cw//2+8,gy-76+lift],fill=OUT)
            rx=Cw//2-62; ry=gy-170-150+lift
        hand={'front':(rx+108,ry+150),'side':(rx+62+flip*20,ry+140),'back':(rx+14,ry+150)}[view]
        wflip=flip if view=='side' else (1 if view=='front' else -1)
        if view=='back': weapon(md,wp,*hand,ang,wflip)
        put(main,figure(uid,view,0 if view=='front' else 1,ang,False,0,0,flip,cut=165),rx,ry)
        put(team,figure(uid,view,0 if view=='front' else 1,ang,True,0,0,flip,cut=165),rx,ry)
        if view=='front':  # mount head in front of rider legs
            d2=ImageDraw.Draw(main)
        if view!='back': weapon(ImageDraw.Draw(main),wp,*hand,ang,wflip)
    else: # trebuchet
        d=md; gy=Ch-20; cx=Cw//2
        arm={'idle':[0,0],'walk':[0]*4,'attack':[0,50,110],'death':[0]*4}[anim][i]
        sx=cx if view!='side' else cx-20
        d.rectangle([cx-150,gy-40,cx+150,gy-20],fill=(130,86,44),outline=OUT,width=4)
        for wx in (cx-120,cx+120):
            r=26; d.ellipse([wx-r,gy-30-r+r,wx+r,gy-30+r+r],fill=(90,60,30),outline=OUT,width=4)
        thick(d,(cx-90,gy-30),(cx,gy-250),14,(150,100,52)); thick(d,(cx+90,gy-30),(cx,gy-250),14,(150,100,52))
        a=math.radians(-60+arm); L1,L2=200,70
        ex=cx+math.cos(a)*L1*(flip if view=='side' else 1)*(0.5 if view!='side' else 1); ey=gy-250-math.sin(a)*L1
        thick(d,(cx,gy-250),(ex,ey),14,(170,118,60))
        cwx=cx-(ex-cx)*L2/L1; cwy=gy-250-(ey-(gy-250))*L2/L1
        d.rectangle([cwx-30,cwy-10,cwx+30,cwy+50],fill=(110,110,120),outline=OUT,width=4)
        # team pennant
        pole=(cx,gy-250); d.line([pole,(cx,gy-320)],fill=OUT,width=6)
        pg=[(cx,gy-320),(cx+70,gy-305),(cx,gy-290)]
        d.polygon(pg,fill=NEUT,outline=OUT); ImageDraw.Draw(team).polygon(pg,fill=(255,255,255))
        # crew shiba
        cw=figure('trebuchet' if False else 'villager',view,(i if anim=='walk' else 1) if view!='front' else 0,0,False,0,0,flip)
        cw=cw.resize((80,147),Image.LANCZOS); crx=cx+(150 if flip>0 else -230) if view=='side' else cx+120
        main.alpha_composite(cw,(int(crx),gy-147))
        tm=figure('villager',view,0 if view=='front' else 1,0,True,0,0,flip).resize((80,147),Image.LANCZOS); team.alpha_composite(tm,(int(crx),gy-147))
    if anim=='death':
        rot=[0,30,60,88][i]*(-flip if view=='side' else -1)
        piv=(Cw//2,Ch-12)
        main=main.rotate(rot,Image.BICUBIC,center=piv); team=team.rotate(rot,Image.BICUBIC,center=piv)
        if i==3:
            for im in (main,team):
                a=im.getchannel('A').point(lambda v:int(v*.6)); im.putalpha(a)
    main=main.resize((fw,fh),Image.LANCZOS); team=team.resize((fw,fh),Image.LANCZOS)
    # team layer as white-alpha mask, clipped to main alpha
    ta=Image.composite(team.getchannel('A'),Image.new('L',team.size,0),main.getchannel('A').point(lambda v:255 if v>40 else 0))
    tl=Image.new('RGBA',team.size,(255,255,255,0)); tl.putalpha(ta)
    return main,tl
ANIMS={'idle':2,'walk':4,'attack':3,'death':4}; DIRS=['S','W','E','N']
man=[]
import sys,os
OUTD=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','art')
ONLY=sys.argv[1].split(',') if len(sys.argv)>1 else list(U)
for uid,(col,(fw,fh),kind,wp) in U.items():
    if uid not in ONLY: continue
    nfr=sum(ANIMS.values())
    sheet=Image.new('RGBA',(fw*nfr,fh*4)); tsheet=sheet.copy()
    for r,dn in enumerate(DIRS):
        c=0
        for an,n in ANIMS.items():
            for i in range(n):
                m,t=frame(uid,dn,an,i); sheet.alpha_composite(m,(c*fw,r*fh)); tsheet.alpha_composite(t,(c*fw,r*fh)); c+=1
    sheet.save(f'{OUTD}/units/{uid}.png'); tsheet.save(f'{OUTD}/units/{uid}_team.png')
    off=0;am={}
    for an,n in ANIMS.items(): am[an]={'start_col':off,'frames':n}; off+=n
    man.append(dict(id=uid,kind='unit',file=f'units/{uid}.png',team_layer=f'units/{uid}_team.png',frame_size={'w':fw,'h':fh},
      sheet_size={'w':fw*nfr,'h':fh*4},rows_directions=DIRS,animations=am,anchor={'x':fw//2,'y':fh-2},footprint=None,base_colour=col))
M=json.load(open(f'{OUTD}/manifest.json')); old={u['id']:i for i,u in enumerate(M['units'])}
for e in man:
    if e['id'] in old: M['units'][old[e['id']]]=e
    else: M['units'].append(e)
json.dump(M,open(f'{OUTD}/manifest.json','w'),indent=1); print('wrote',[e['id'] for e in man])
