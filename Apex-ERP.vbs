' Apex Software ERP - Silent Windows Launcher
' Launches the system in the background with zero CMD/terminal windows

Set WshShell = CreateObject("WScript.Shell")
strPath = Wscript.ScriptFullName
Set objFSO = CreateObject("Scripting.FileSystemObject")
Set objFile = objFSO.GetFile(strPath)
strFolder = objFSO.GetParentFolderName(objFile)
WshShell.CurrentDirectory = strFolder

' Run PowerShell completely hidden (0) without waiting (False)
WshShell.Run "powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & strFolder & "\scripts\start-windows.ps1""", 0, False
