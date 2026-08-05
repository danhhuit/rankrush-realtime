$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Runtime.InteropServices;
using System.Threading;

public static class ClipboardMetafile {
    [DllImport("user32.dll")] private static extern bool OpenClipboard(IntPtr hWndNewOwner);
    [DllImport("user32.dll")] private static extern bool CloseClipboard();
    [DllImport("user32.dll")] private static extern IntPtr GetClipboardData(uint uFormat);
    [DllImport("gdi32.dll", CharSet = CharSet.Auto)]
    private static extern IntPtr CopyEnhMetaFile(IntPtr hemfSrc, string lpszFile);

    public static void SavePng(string path) {
        const uint CF_ENHMETAFILE = 14;
        bool opened = false;
        for (int i = 0; i < 30 && !opened; i++) {
            opened = OpenClipboard(IntPtr.Zero);
            if (!opened) Thread.Sleep(100);
        }
        if (!opened) throw new InvalidOperationException("Cannot open clipboard.");
        IntPtr source;
        try {
            source = GetClipboardData(CF_ENHMETAFILE);
            if (source == IntPtr.Zero) throw new InvalidOperationException("Enhanced metafile is missing.");
            source = CopyEnhMetaFile(source, null);
        } finally {
            CloseClipboard();
        }
        if (source == IntPtr.Zero) throw new InvalidOperationException("Cannot copy enhanced metafile.");
        using (var metafile = new Metafile(source, true)) {
            int width = Math.Max(1, metafile.Width);
            int height = Math.Max(1, metafile.Height);
            using (var bitmap = new Bitmap(width, height, PixelFormat.Format32bppArgb)) {
                bitmap.SetResolution(144, 144);
                using (var graphics = Graphics.FromImage(bitmap)) {
                    graphics.Clear(Color.White);
                    graphics.DrawImage(metafile, 0, 0, width, height);
                }
                bitmap.Save(path, ImageFormat.Png);
            }
        }
    }
}
"@ -ReferencedAssemblies System.Drawing

$docPath = "D:\nosql\project\RankRush\rankrush-realtime\output\Bao_cao_ky_thuat_va_luong_xu_ly_RankRush.docx"
$qa = "D:\nosql\project\RankRush\rankrush-realtime\output\qa_rankrush_report\page_snapshots"
$log = "D:\nosql\project\RankRush\rankrush-realtime\output\qa_rankrush_report\word-snapshot.log"
New-Item -ItemType Directory -Force -Path $qa | Out-Null
Get-ChildItem -LiteralPath $qa -Filter "page-*.png" -ErrorAction SilentlyContinue | Remove-Item -Force
"START $(Get-Date -Format o)" | Set-Content -LiteralPath $log -Encoding UTF8

$word = New-Object -ComObject Word.Application
$word.Visible = $true
$word.DisplayAlerts = 0
try {
    $doc = $word.Documents.Open($docPath, $false, $true, $false)
    $word.ActiveWindow.WindowState = 2
    $pages = $doc.ComputeStatistics(2)
    "PAGES $pages" | Add-Content -LiteralPath $log -Encoding UTF8
    for ($i = 1; $i -le $pages; $i++) {
        $startRange = $doc.GoTo(1, 1, $i)
        if ($i -lt $pages) {
            $nextRange = $doc.GoTo(1, 1, $i + 1)
            $end = [Math]::Max($startRange.Start, $nextRange.Start - 1)
        }
        else {
            $end = $doc.Content.End - 1
        }
        $pageRange = $doc.Range($startRange.Start, $end)
        [System.Windows.Forms.Clipboard]::Clear()
        $pageRange.Select()
        $word.Selection.CopyAsPicture()
        Start-Sleep -Milliseconds 500
        $path = Join-Path $qa ("page-{0:D2}.png" -f $i)
        [ClipboardMetafile]::SavePng($path)
        "PAGE $i $path" | Add-Content -LiteralPath $log -Encoding UTF8
    }
    $doc.Close($false)
}
finally {
    $word.Quit()
}
"DONE $(Get-Date -Format o)" | Add-Content -LiteralPath $log -Encoding UTF8
