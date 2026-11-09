import struct,glob,sys
def load(n):
    b=open('vram/%05d.bin'%n,'rb').read()
    w=struct.unpack('<%dH'%(len(b)//2),b)
    scb2=w[0:0x200]; scb3=w[0x200:0x400]; scb4=w[0x400:0x600]
    scb1=[w[0x600+i*64:0x600+i*64+64] for i in range(381)]
    pal=w[0x600+381*64:]
    return scb1,scb2,scb3,scb4,pal
def objects(n):
    scb1,scb2,scb3,scb4,pal=load(n); objs=[]; cur=None
    for i in range(381):
        s3=scb3[i]; sticky=(s3>>6)&1; h=s3&0x3f
        if not sticky:
            y=496-(s3>>7); x=scb4[i]>>7
            if x>=0x1e0: x-=0x200
            if y> 288: y-=512
            cur={'i':i,'n':1,'x':x,'y':y,'h':h,'zx':(scb2[i]>>8)&0xf,'zy':scb2[i]&0xff,'tiles':[],'pals':set()}; objs.append(cur)
        elif cur is not None: cur['n']+=1
        if cur is None: continue
        hh=cur['h']; 
        for t in range(min(hh,32)):
            a=scb1[i][t*2]; b=scb1[i][t*2+1]
            tile=a|(((b>>4)&0xf)<<16); p=b>>8
            if tile: cur['tiles'].append(tile); cur['pals'].add(p)
    return [o for o in objs if o['h']>0 and o['tiles']]
if __name__=='__main__':
    for n in map(int,sys.argv[1:]):
        print('== frame',n)
        for o in objects(n):
            print(' spr%3d n%2d x%4d y%4d h%2d zoom %x/%02x pals %s ntiles %d uniq %d'%(o['i'],o['n'],o['x'],o['y'],o['h'],o['zx'],o['zy'],sorted(o['pals']),len(o['tiles']),len(set(o['tiles']))))
