!macro customInstall
  ; --- Chrome Extension: copy unpacked files to ProgramData (for Load Unpacked debugging) ---
  CreateDirectory "C:\ProgramData\ValerieAgent\chrome-extension"
  CopyFiles /SILENT "$INSTDIR\resources\chrome-extension\*.*" "C:\ProgramData\ValerieAgent\chrome-extension"

  ; --- Chrome Extension: copy CRX to ProgramData ---
  CopyFiles /SILENT "$INSTDIR\resources\valerie-url-bridge.crx" "C:\ProgramData\ValerieAgent\valerie-url-bridge.crx"

  ; --- Delete old extension registry keys (pdnlbaclbmfbipieaeknjkopdcafeepf) ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"

  ; --- Chrome External Extension registry: CRX-based install (64-bit) ---
  WriteRegStr HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk" "path" "C:\ProgramData\ValerieAgent\valerie-url-bridge.crx"
  WriteRegStr HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk" "version" "1.0.0"

  ; --- Chrome External Extension registry: CRX-based install (32-bit fallback) ---
  WriteRegStr HKLM "SOFTWARE\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk" "path" "C:\ProgramData\ValerieAgent\valerie-url-bridge.crx"
  WriteRegStr HKLM "SOFTWARE\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk" "version" "1.0.0"
!macroend

!macro customUnInstall
  ; --- Remove Chrome Extension registry keys (new ID) ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\lpdlfbkigloncemklhgcclimjfbglfkk"

  ; --- Remove old extension registry keys (in case upgrading from v0.3.0) ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"

  ; --- Remove extension files ---
  RMDir /r "C:\ProgramData\ValerieAgent\chrome-extension"
  Delete "C:\ProgramData\ValerieAgent\valerie-url-bridge.crx"
!macroend
