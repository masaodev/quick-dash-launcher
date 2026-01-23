$targetProcesses = @('TextInputHost', 'explorer', 'chrome', 'SystemSettings', 'ApplicationFrameHost', 'Todo', 'stickies', 'Code', 'WindowsTerminal')

$results = Get-WmiObject Win32_Process | Where-Object {
    $name = $_.Name -replace '\.exe$', ''
    $targetProcesses -contains $name
} | ForEach-Object {
    $owner = $_.GetOwner()
    $ownerName = if ($owner.Domain -and $owner.User) {
        "$($owner.Domain)\$($owner.User)"
    } elseif ($owner.User) {
        $owner.User
    } else {
        "SYSTEM"
    }
    "$($_.Name)|$($_.ProcessId)|$ownerName"
}

$results
