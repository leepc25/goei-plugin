local P=manager.machine.ioport.ports
local function F(port,name) return P[port].fields[name] end
local coin=F(':AUDIO_COIN','Coin 1'); local start=F(':edge:joy:START','1 Player Start')
local A=F(':edge:joy:JOY1','P1 A'); local C=F(':edge:joy:JOY1','P1 C'); local Rt=F(':edge:joy:JOY1','P1 Right'); local Dn=F(':edge:joy:JOY1','P1 Down'); local Lf=F(':edge:joy:JOY1','P1 Left')
local mem=manager.machine.devices[':maincpu'].spaces['program']
local cands={0x100d1c,0x100f31,0x1011ca,0x108171,0x108177,0x1082e7,0x108259,0x10a7f1,0x10a84d,0x10a858}
local n=0
local T0=1900
-- 무식: ↓ ↘ → ↘ ↓ ↙ ← + C
local seq={{'D'},{'D','R'},{'R'},{'D','R'},{'D'},{'D','L'},{'L'},{'L','C'}}
emu.register_frame_done(function()
  n=n+1
  coin:set_value((n>=300 and n<306) and 1 or 0)
  start:set_value((n>=400 and n<406) and 1 or 0)
  A:set_value((n>=480 and n<1400 and n%40<4) and 1 or 0)
  if n>=1700 and n<T0 then for _,a in ipairs(cands) do mem:write_u8(a,3) end end
  local d,r,l,c=0,0,0,0
  local k=n-T0
  if k>=0 and k<#seq*3 then
    local s=seq[math.floor(k/3)+1]
    for _,x in ipairs(s) do if x=='D' then d=1 elseif x=='R' then r=1 elseif x=='L' then l=1 elseif x=='C' then c=1 end end
  end
  Dn:set_value(d); Rt:set_value(r); Lf:set_value(l); C:set_value(c)
  if n>=T0-30 and n<T0+300 and n%3==0 then manager.machine.video:snapshot() end
end)
