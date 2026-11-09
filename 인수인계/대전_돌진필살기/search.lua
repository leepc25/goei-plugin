local P=manager.machine.ioport.ports
local function F(port,name) return P[port].fields[name] end
local coin=F(':AUDIO_COIN','Coin 1'); local start=F(':edge:joy:START','1 Player Start')
local A=F(':edge:joy:JOY1','P1 A'); local C=F(':edge:joy:JOY1','P1 C'); local R=F(':edge:joy:JOY1','P1 Right'); local D=F(':edge:joy:JOY1','P1 Down')
local mem=manager.machine.devices[':maincpu'].spaces['program']
local n=0
emu.register_frame_done(function()
  n=n+1
  coin:set_value((n>=300 and n<306) and 1 or 0)
  start:set_value((n>=400 and n<406) and 1 or 0)
  A:set_value((n>=480 and n<1400 and n%40<4) and 1 or 0)
  local fight = n>=1600
  R:set_value((fight and n%60<30) and 1 or 0)
  C:set_value((fight and n%12<3) and 1 or 0)
  D:set_value((fight and n%60>=45) and 1 or 0)
  if n>=1500 and n%120==0 then
    manager.machine.video:snapshot()
    local f=io.open(string.format('ram/%06d.bin',n),'wb')
    local t={}
    for a=0x100000,0x10FFFF do t[#t+1]=string.char(mem:read_u8(a)) end
    f:write(table.concat(t)); f:close()
  end
end)
