$ErrorActionPreference = "Stop"
$doc = "D:\nosql\project\RankRush\rankrush-realtime\output\Bao_cao_ky_thuat_va_luong_xu_ly_RankRush.docx"
$qa = "D:\nosql\project\RankRush\rankrush-realtime\output\qa_rankrush_report"
$pdf = Join-Path $qa "Bao_cao_ky_thuat_va_luong_xu_ly_RankRush.pdf"
$log = Join-Path $qa "word-render.log"

New-Item -ItemType Directory -Force -Path $qa | Out-Null
"START $(Get-Date -Format o)" | Set-Content -LiteralPath $log -Encoding UTF8
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    "OPEN $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $opened = $word.Documents.Open($doc, $false, $true, $false)
    $opened.ShowRevisions = $false
    "EXPORT $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $opened.SaveAs2($pdf, 17)
    "CLOSE $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $opened.Close($false)
}
finally {
    $word.Quit()
}
"DONE $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
