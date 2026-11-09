local n=0
emu.register_frame_done(function()
  n=n+1
  if n%60==0 then manager.machine.video:snapshot() end
end)
