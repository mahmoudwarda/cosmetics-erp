; ------------------------------------------------------------------------------
; Inno Setup Script for Cosmetics ERP (نظام لمسة جمال)
; Compiles the entire system into a single standalone Setup.exe installer
; ------------------------------------------------------------------------------

#define MyAppName "نظام لمسة جمال لإدارة النشاط التجاري"
#define MyAppShortName "CosmeticsERP"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Cosmetics ERP"
#define MyAppExeName "تشغيل-السيستم.bat"

[Setup]
AppId={{E6D8A915-4B83-49F1-8B1E-14DF79F8B520}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
DefaultDirName=C:\Cosmetics-ERP
DefaultGroupName={#MyAppName}
DisableDirPage=no
DisableProgramGroupPage=yes
OutputDir=..\Client-Installer-Setup
OutputBaseFilename=Cosmetics-Setup
Compression=lzma2/normal
SolidCompression=yes
WizardStyle=modern
PrivilegesRequired=admin

[Languages]
Name: "arabic"; MessagesFile: "compiler:Languages\Arabic.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "إنشاء اختصار على سطح المكتب (Desktop Shortcut)"; GroupDescription: "أيقونات إضافية:"

[Files]
; Copy all necessary files while excluding development tools, source maps (*.map), logs, and active databases
Source: "*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "*.map,data\pgdata\*,data\postgres\*,data\*.log,work\postgresql-portable\pgsql\pgAdmin 4\*,node_modules\vitest\*,node_modules\@vitest\*,node_modules\eslint\*,node_modules\@eslint\*,node_modules\eslint-*\*,node_modules\@typescript-eslint\*,node_modules\typescript\*,node_modules\.cache\*,.git\*,.next\*,.next-build\*,.next-build-*\*,*.zip,*.tar,Client-Installer-Setup\*"

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; WorkingDir: "{app}"; Tasks: desktopicon

[Run]
; Add Firewall rule for port 3001 so other network devices can access smoothly
Filename: "netsh"; Parameters: "advfirewall firewall add rule name=""CosmeticsERP_3001"" dir=in action=allow protocol=TCP localport=3001"; Flags: runhidden
; Launch the system immediately
Filename: "{app}\{#MyAppExeName}"; Description: "تشغيل النظام الآن"; Flags: nowait postinstall skipifsilent
