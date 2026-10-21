#define MyAppName "Apex Software ERP"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Apex Software"
#define PayloadDir "build\windows-payload"

[Setup]
AppId={{E6D8A915-4B83-49F1-8B1E-14DF79F8B520}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\ApexSoftware-ERP
DisableProgramGroupPage=yes
OutputDir=dist-installer
OutputBaseFilename=Apex-Software-ERP-Setup
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64
Uninstallable=yes
CloseApplications=yes
RestartApplications=no

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار على سطح المكتب"; GroupDescription: "اختصارات إضافية:"; Flags: checkedonce
Name: "autostart"; Description: "تشغيل النظام تلقائياً في الخلفية عند فتح الويندوز (موصى به)"; GroupDescription: "خيارات التشغيل:"; Flags: checkedonce

[Dirs]
Name: "{app}\data"; Permissions: users-modify

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Apex-ERP.vbs"""; WorkingDir: "{app}"
Name: "{autoprograms}\{#MyAppName}\حالة النظام"; Filename: "{app}\حالة-السيستم.bat"; WorkingDir: "{app}"
Name: "{autoprograms}\{#MyAppName}\إيقاف النظام"; Filename: "{app}\إيقاف-السيستم.bat"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Apex-ERP.vbs"""; WorkingDir: "{app}"; Tasks: desktopicon
Name: "{commonstartup}\{#MyAppName}"; Filename: "{sys}\wscript.exe"; Parameters: """{app}\Apex-ERP.vbs"""; WorkingDir: "{app}"; Tasks: autostart

[Run]
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=\"ApexSoftwareERP-LAN\" dir=in action=allow protocol=TCP localport=3001 profile=private"; Flags: runhidden
Filename: "{sys}\wscript.exe"; Parameters: """{app}\Apex-ERP.vbs"""; Description: "تشغيل النظام في الخلفية الآن"; Flags: postinstall nowait skipifsilent runasoriginaluser

[UninstallRun]
Filename: "powershell.exe"; Parameters: "-NoLogo -NoProfile -ExecutionPolicy Bypass -File ""{app}\scripts\stop-windows.ps1"""; Flags: runhidden
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=\"ApexSoftwareERP-LAN\""; Flags: runhidden
