param(
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$Files
)

$ErrorActionPreference = 'Stop'

if (-not $Files -or $Files.Count -eq 0) {
  throw '请传入待签名的 exe 文件路径。'
}

$signtool = Get-ChildItem 'C:\Program Files (x86)\Windows Kits\10\bin' -Recurse -Filter signtool.exe -ErrorAction SilentlyContinue |
  Where-Object { $_.FullName -match '\\x64\\signtool\.exe$' } |
  Sort-Object FullName -Descending |
  Select-Object -First 1 -ExpandProperty FullName

if (-not $signtool) {
  throw '未找到 signtool.exe。请安装 Windows SDK Signing Tools。'
}

$timestampUrl = if ($env:WINDOWS_CODESIGN_TIMESTAMP_URL) { $env:WINDOWS_CODESIGN_TIMESTAMP_URL } else { 'http://timestamp.digicert.com' }
$thumbprint = $env:WINDOWS_CODESIGN_THUMBPRINT
$pfxPath = $env:WINDOWS_CODESIGN_PFX
$pfxPassword = $env:WINDOWS_CODESIGN_PASSWORD

if ($thumbprint) {
  $signArgs = @('sign', '/sha1', $thumbprint, '/fd', 'SHA256', '/tr', $timestampUrl, '/td', 'SHA256')
} elseif ($pfxPath) {
  if (-not (Test-Path -LiteralPath $pfxPath)) { throw "代码签名证书不存在：$pfxPath" }
  if (-not $pfxPassword) { throw '已设置 WINDOWS_CODESIGN_PFX，但缺少 WINDOWS_CODESIGN_PASSWORD。' }
  $signArgs = @('sign', '/f', $pfxPath, '/p', $pfxPassword, '/fd', 'SHA256', '/tr', $timestampUrl, '/td', 'SHA256')
} else {
  throw '未配置代码签名证书。请设置 WINDOWS_CODESIGN_THUMBPRINT，或设置 WINDOWS_CODESIGN_PFX 与 WINDOWS_CODESIGN_PASSWORD。'
}

foreach ($file in $Files) {
  if (-not (Test-Path -LiteralPath $file)) { throw "待签名文件不存在：$file" }
  & $signtool @signArgs $file
  if ($LASTEXITCODE -ne 0) { throw "签名失败：$file" }
  & $signtool verify /pa /all $file
  if ($LASTEXITCODE -ne 0) { throw "签名验证失败：$file" }
  Write-Host "已签名并验证：$file"
}