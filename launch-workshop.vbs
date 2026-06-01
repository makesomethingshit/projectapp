Set shell = CreateObject("WScript.Shell")
projectPath = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
command = "cmd.exe /c cd /d """ & projectPath & """ && npm.cmd start"
shell.Run command, 0, False
