$port = New-Object System.IO.Ports.SerialPort "COM6", 115200
$port.ReadTimeout = 4000
try {
    $port.Open()
    for ($i = 0; $i -lt 10; $i++) {
        try {
            $line = $port.ReadLine()
            Write-Output $line
        } catch [System.TimeoutException] {
            Write-Output "TIMEOUT_WAITING"
        }
    }
    $port.Close()
} catch {
    Write-Output "CANNOT_OPEN_PORT: $($_.Exception.Message)"
}
