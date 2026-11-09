local P=manager.machine.ioport.ports
local function F(port,name) return P[port].fields[name] end
local c1=F(':AUDIO_COIN','Coin 1'); local c2=F(':AUDIO_COIN','Coin 2')
local s1=F(':edge:joy:START','1 Player Start'); local s2=F(':edge:joy:START','2 Players Start')
local J=':edge:joy:JOY1'
local A=F(J,'P1 A'); local C=F(J,'P1 C'); local Rt=F(J,'P1 Right'); local Dn=F(J,'P1 Down'); local Lf=F(J,'P1 Left')
local A2=F(':edge:joy:JOY2','P2 A')
local mem=manager.machine.devices[':maincpu'].spaces['program']
local cands0={0x100d1c,0x100f31,0x1011ca,0x108171,0x108177,0x1082e7,0x108259,0x10a7f1,0x10a84d,0x10a858}
local W=tonumber(os.getenv('WHICH') or '0')
local seqs={
 {{'D'},{'D','L'},{'L'},{'D','L'},{'D'},{'D','R'},{'R','A'},{'R','A'}}, -- 파워 게이저
 {{'D'},{'D','R'},{'R'},{'D'},{'D','R'},{'R','A'},{'R','A'}},          -- 버스터 울프
}
local S0=tonumber(os.getenv('S0') or '1700'); local S1=tonumber(os.getenv('S1') or '3000')
local n=0
emu.register_frame_done(function()
  n=n+1
  c1:set_value((n>=300 and n<306) and 1 or 0); c2:set_value((n>=320 and n<326) and 1 or 0)
  s1:set_value((n>=400 and n<406) and 1 or 0); s2:set_value((n>=420 and n<426) and 1 or 0)
  local a=(n>=480 and n<1400 and n%40<4) and 1 or 0
  A2:set_value((n>=500 and n<1400 and n%40<4) and 1 or 0)
  if n>=1300 and n<(tonumber(os.getenv('GS1') or '99999')) then mem:write_u8(0x1081e8,tonumber(os.getenv('GV') or '127')); mem:write_u8(0x10824e,tonumber(os.getenv('GV') or '127')) end
  local d,r,l=0,0,0
  local T=tonumber(os.getenv('T0') or '1500'); local PER=tonumber(os.getenv('PER') or '150')
  if n>=T then
    local k=(n-T)%PER; local sq=seqs[(math.floor((n-T)/PER)+W)%2+1]
    if k<#sq*2 then for _,x in ipairs(sq[math.floor(k/2)+1]) do if x=='D' then d=1 elseif x=='R' then r=1 elseif x=='L' then l=1 elseif x=='A' then a=1 end end end
  end
  Dn:set_value(d); Rt:set_value(r); Lf:set_value(l); A:set_value(a)
  if n>=S0 and n<S1 and (n%10==0 or os.getenv('ALL')=='1') then manager.machine.video:snapshot() end
end)
