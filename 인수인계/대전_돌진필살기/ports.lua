local n=0
emu.register_frame_done(function()
  n=n+1
  if n==5 then
    for tag,port in pairs(manager.machine.ioport.ports) do
      for name,f in pairs(port.fields) do print(tag.." | "..name) end
    end
    manager.machine:exit()
  end
end)
