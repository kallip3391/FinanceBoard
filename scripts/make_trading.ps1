$src = 'd:\10.Coding\01.Vibe\FinanceBoard\src\app\transactions\overseas\page.js'
$dst = 'd:\10.Coding\01.Vibe\FinanceBoard\src\app\transactions\trading\page.js'

$content = [System.IO.File]::ReadAllText($src, [System.Text.Encoding]::UTF8)

$content = $content -replace 'TRANSACTION_TYPES\.OVERSEAS', 'TRANSACTION_TYPES.DOMESTIC'
$content = $content -replace 'getOverseasTransactions', 'getDomesticTransactions'
$content = $content -replace "currency: 'USD'", "currency: 'KRW'"
$content = $content -replace "searchStocksByName\(searchTerm, 'OVERSEAS'\)", "searchStocksByName(searchTerm, 'KRW')"
$content = $content -replace 'overseasOnly=true', 'overseasOnly=false'
$content = $content -replace "import \{ Edit2, Trash2, Filter, RotateCcw, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, Globe, Plus \}", "import { Edit2, Trash2, Filter, RotateCcw, X, Calendar, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Check, ArrowLeftRight, Plus }"
$content = $content -replace '<Globe size=\{20\} strokeWidth=\{2\.5\} />', '<ArrowLeftRight size={20} strokeWidth={2.5} />'
$content = $content -replace 'text-indigo-600 rounded-xl border border-indigo-100/50', 'text-indigo-600 rounded-xl border border-indigo-100/50'
$content = $content -replace '([^<>])해외([^<>])', '$1국내$2'

[System.IO.File]::WriteAllText($dst, $content, [System.Text.Encoding]::UTF8)
Write-Host "Done"
