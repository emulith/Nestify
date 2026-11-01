Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "Z:\Edit zooi- Vids\progameren\spotify"
WshShell.Run "node server.js --autocast", 0, False
