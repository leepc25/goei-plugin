local P=manager.machine.ioport.ports
local function F(port,name) return P[port].fields[name] end
local coin=F(':AUDIO_COIN','Coin 1'); local start=F(':edge:joy:START','1 Player Start')
local A=F(':edge:joy:JOY1','P1 A'); local C=F(':edge:joy:JOY1','P1 C'); local Rt=F(':edge:joy:JOY1','P1 Right'); local Dn=F(':edge:joy:JOY1','P1 Down'); local Lf=F(':edge:joy:JOY1','P1 Left')
local mem=manager.machine.devices[':maincpu'].spaces['program']
local cands={0x100d1c,0x100f31,0x1011ca,0x108171,0x108177,0x1082e7,0x108259,0x10a7f1,0x10a84d,0x10a858}
local n=0
-- 버스터 울프: ↓ ↘ → ↓ ↘ → + A   (2f씩)
local seq={{'D'},{'D','R'},{'R'},{'D'},{'D','R'},{'R','A'},{'R','A'}}
local snapon=os.getenv('SNAP')=='1'
emu.register_frame_done(function()
  n=n+1
  coin:set_value((n>=300 and n<306) and 1 or 0)
  start:set_value((n>=400 and n<406) and 1 or 0)
  local a=(n>=480 and n<1460 and n%40<4) and 1 or 0
  if n>=1500 then for _,ad in ipairs(cands) do mem:write_u8(ad,3) end end
  local d,r,l,c=0,0,0,0
  if n>=1620 then
    local k=(n-1620)%300
    if k<#seq*2 then
      for _,x in ipairs(seq[math.floor(k/2)+1]) do if x=='D' then d=1 elseif x=='R' then r=1 elseif x=='A' then a=1 end end
    end
  end
  Dn:set_value(d); Rt:set_value(r); Lf:set_value(l); A:set_value(a); C:set_value(c)
  if n>=1615 and n<2520 then manager.machine.video:snapshot() end
end)
