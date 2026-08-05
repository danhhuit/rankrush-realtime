$ErrorActionPreference = "Stop"
$doc = "D:\nosql\project\RankRush\rankrush-realtime\output\Bao_cao_ky_thuat_va_luong_xu_ly_RankRush.docx"
$log = "D:\nosql\project\RankRush\rankrush-realtime\output\qa_rankrush_report\word-inspect.log"
"START $(Get-Date -Format o)" | Set-Content -LiteralPath $log -Encoding UTF8
$word = New-Object -ComObject Word.Application
$word.Visible = $false
$word.DisplayAlerts = 0
try {
    $opened = $word.Documents.Open($doc, $false, $true, $false)
    "OPEN $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $pages = $opened.ComputeStatistics(2)
    "PAGES $pages $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $words = $opened.ComputeStatistics(0)
    "WORDS $words $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
    $opened.Close($false)
}
finally {
    $word.Quit()
}
"DONE $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
