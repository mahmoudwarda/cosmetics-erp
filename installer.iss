#define MyAppName "نظام لمسة جمال"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Cosmetics ERP"
#define PayloadDir "build\windows-payload"

[Setup]
AppId={{E6D8A915-4B83-49F1-8B1E-14DF79F8B520}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\Cosmetics-ERP
DisableProgramGroupPage=yes
OutputDir=dist-installer
OutputBaseFilename=Cosmetics-ERP-Setup
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

[Dirs]
Name: "{app}\data"; Permissions: users-modify

[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\تشغيل-السيستم.bat"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\تشغيل-السيستم.bat"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=\"CosmeticsERP-LAN\" dir=in action=allow protocol=TCP localport=3001 profile=private"; Flags: runhidden
Filename: "{app}\تشغيل-السيستم.bat"; Description: "تشغيل النظام الآن"; Flags: postinstall nowait skipifsilent runasoriginaluser

[UninstallRun]
Filename: "netsh"; Parameters: "advfirewall firewall delete rule name=\"CosmeticsERP-LAN\""; Flags: runhidden
