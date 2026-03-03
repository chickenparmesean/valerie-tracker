!macro customInstall
  ; --- Chrome Extension: copy unpacked files to ProgramData (for Load Unpacked debugging) ---
  CreateDirectory "C:\ProgramData\ValerieAgent\chrome-extension"
  CopyFiles /SILENT "$INSTDIR\resources\chrome-extension\*.*" "C:\ProgramData\ValerieAgent\chrome-extension"

  ; --- Chrome Extension: copy CRX to ProgramData ---
  CopyFiles /SILENT "$INSTDIR\resources\valerie-url-bridge.crx" "C:\ProgramData\ValerieAgent\valerie-url-bridge.crx"

  ; --- Delete old extension registry keys (pdnlbaclbmfbipieaeknjkopdcafeepf) ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"

  ; --- Delete old CRX registry keys if upgrading from v0.3.1-v0.3.4 ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk"

  ; --- Write update.xml manifest for Chrome enterprise force-install ---
  FileOpen $0 "C:\ProgramData\ValerieAgent\update.xml" w
  FileWrite $0 '<?xml version="1.0" encoding="UTF-8"?>$\r$\n'
  FileWrite $0 '<gupdate xmlns="http://www.google.com/update2/response" protocol="2.0">$\r$\n'
  FileWrite $0 '  <app appid="lpdlfbkigloncemklhgcclimjfbglfkk">$\r$\n'
  FileWrite $0 '    <updatecheck codebase="file:///C:/ProgramData/ValerieAgent/valerie-url-bridge.crx" version="1.0.0" />$\r$\n'
  FileWrite $0 '  </app>$\r$\n'
  FileWrite $0 '</gupdate>$\r$\n'
  FileClose $0

  ; --- Chrome enterprise policy: force-install extension ---
  WriteRegStr HKLM "SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" "1" "lpdlfbkigloncemklhgcclimjfbglfkk;file:///C:/ProgramData/ValerieAgent/update.xml"
!macroend

!macro customUnInstall
  ; --- Remove Chrome enterprise policy force-install ---
  DeleteRegValue HKLM "SOFTWARE\Policies\Google\Chrome\ExtensionInstallForcelist" "1"

  ; --- Remove update.xml manifest ---
  Delete "C:\ProgramData\ValerieAgent\update.xml"

  ; --- Remove old CRX registry keys (in case upgrading from v0.3.1-v0.3.4) ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk"

  ; --- Remove old extension registry keys (in case upgrading from v0.3.0) ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"

  ; --- Remove extension files ---
  RMDir /r "C:\ProgramData\ValerieAgent\chrome-extension"
  Delete "C:\ProgramData\ValerieAgent\valerie-url-bridge.crx"
!macroend
