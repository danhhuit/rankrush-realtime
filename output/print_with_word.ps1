$ErrorActionPreference = "Stop"
$doc = "D:\nosql\project\RankRush\rankrush-realtime\output\Bao_cao_ky_thuat_va_luong_xu_ly_RankRush.docx"
$qa = "D:\nosql\project\RankRush\rankrush-realtime\output\qa_rankrush_report"
$pdf = Join-Path $qa "Bao_cao_ky_thuat_va_luong_xu_ly_RankRush.pdf"
$log = Join-Path $qa "word-print.log"
Remove-Item -LiteralPath $pdf -ErrorAction SilentlyContinue
"START $(Get-Date -Format o)" | Set-Content -LiteralPath $log -Encoding UTF8
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $opened = $word.Documents.Open($doc, $false, $true, $false)
    "OPEN $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $word.ActivePrinter = "Microsoft Print to PDF"
    "PRINT $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $opened.PrintOut($false, $false, 0, $pdf, [Type]::Missing, [Type]::Missing,
        0, 1, [Type]::Missing, 1, $true, $false, [Type]::Missing, $false,
        0, 0, 0, 0)
    "CLOSE $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $opened.Close($false)
}
finally {
    $word.Quit()
}
"DONE $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
