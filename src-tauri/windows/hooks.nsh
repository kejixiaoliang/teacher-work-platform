!macro TEACHER_WORK_CLEANUP
  ; Close every Teacher Work instance and its child tree before touching files.
  nsExec::ExecToLog 'taskkill.exe /F /T /IM teacher-work.exe'

  ; Kill only node.exe processes launched from this installation, then wait.
  ; Avoid a WMI -Filter string here so NSIS does not have to parse nested quotes.
  nsExec::ExecToLog '$SYSDIR\WindowsPowerShell\v1.0\powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$root = [IO.Path]::GetFullPath(''$INSTDIR''); $node = [IO.Path]::GetFullPath((Join-Path $root ''resources\runtime\node.exe'')); Get-CimInstance Win32_Process | Where-Object { $_.Name -ieq ''node.exe'' -and $_.ExecutablePath -and ([IO.Path]::GetFullPath($_.ExecutablePath) -ieq $node) } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force; Wait-Process -Id $_.ProcessId -Timeout 5 -ErrorAction SilentlyContinue }"'
!macroend

!macro NSIS_HOOK_PREINSTALL
  !insertmacro TEACHER_WORK_CLEANUP
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  !insertmacro TEACHER_WORK_CLEANUP
!macroend
