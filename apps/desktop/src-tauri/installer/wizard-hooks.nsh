!macro NSIS_HOOK_PREINSTALL
  DetailPrint "正在准备本地写作环境..."
  DetailPrint "正在检查应用数据目录..."
!macroend

!macro NSIS_HOOK_POSTINSTALL
  DetailPrint "正在创建快捷方式与卸载信息..."
  DetailPrint "微光写作台安装完成。"
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  DetailPrint "正在关闭并清理微光写作台程序文件..."
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DetailPrint "微光写作台已卸载。"
!macroend