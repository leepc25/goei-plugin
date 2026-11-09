local n=0
emu.register_frame_done(function() n=n+1 if n==5 then
 for k,v in pairs(manager.machine.memory.shares) do print('share',k,v.size) end
 for k,v in pairs(manager.machine.memory.regions) do print('region',k,v.size) end
 for k,v in pairs(manager.machine.devices) do if k:find('sprite') or k:find('video') then print('dev',k) end end
 manager.machine:exit() end end)
