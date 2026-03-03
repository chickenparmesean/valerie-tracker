!macro customInstall
  ; --- Chrome Extension: copy files to ProgramData ---
  CreateDirectory "C:\ProgramData\ValerieAgent\chrome-extension"
  CopyFiles /SILENT "$INSTDIR\resources\chrome-extension\*.*" "C:\ProgramData\ValerieAgent\chrome-extension"

  ; --- Chrome External Extension registry (64-bit) ---
  WriteRegStr HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf" "path" "C:\ProgramData\ValerieAgent\chrome-extension"
  WriteRegStr HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf" "version" "1.0.0"

  ; --- Chrome External Extension registry (32-bit fallback) ---
  WriteRegStr HKLM "SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf" "path" "C:\ProgramData\ValerieAgent\chrome-extension"
  WriteRegStr HKLM "SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf" "version" "1.0.0"
!macroend

!macro customUnInstall
  ; --- Remove Chrome Extension registry keys ---
  DeleteRegKey HKLM "SOFTWARE\WOW6432Node\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"
  DeleteRegKey HKLM "SOFTWARE\Google\Chrome\Extensions\pdnlbaclbmfbipieaeknjkopdcafeepf"

  ; --- Remove extension files ---
  RMDir /r "C:\ProgramData\ValerieAgent\chrome-extension"
!macroend
