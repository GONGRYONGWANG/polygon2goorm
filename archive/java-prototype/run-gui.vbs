Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

projectDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = projectDir

distLib = projectDir & "\build\install\polygon2goorm\lib"

If Not fso.FolderExists(distLib) Then
  buildCommand = "cmd /c cd /d """ & projectDir & """ && "
  If fso.FileExists("C:\Gradle\gradle-9.4.1\bin\gradle.bat") Then
    buildCommand = buildCommand & "set ""PATH=C:\Gradle\gradle-9.4.1\bin;%PATH%"" && "
  End If
  buildCommand = buildCommand & "gradle installDist"
  shell.Run buildCommand, 0, True
End If

javaw = shell.ExpandEnvironmentStrings("%JAVA_HOME%") & "\bin\javaw.exe"
If Not fso.FileExists(javaw) Then
  javaw = "javaw.exe"
End If

runCommand = """" & javaw & """ -cp """ & distLib & "\*"" com.polygon2goorm.gui.Polygon2GoormGui"
shell.Run runCommand, 0, False
