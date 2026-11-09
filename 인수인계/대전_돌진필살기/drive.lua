local P=manager.machine.ioport.ports
local function F(port,name) return P[port].fields[name] end
local coin=F(':AUDIO_COIN','Coin 1'); local start=F(':edge:joy:START','1 Player Start')
local A=F(':edge:joy:JOY1','P1 A')
local n=0
emu.register_frame_done(function()
  n=n+1
  coin:set_value((n>=300 and n<306) and 1 or 0)
  start:set_value((n>=400 and n<406) and 1 or 0)
  A:set_value((n>=480 and n<3600 and n%40<4) and 1 or 0)
  if n%60==0 then manager.machine.video:snapshot() end
end)
