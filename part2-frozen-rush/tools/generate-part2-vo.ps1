# Generate the missing Part 2 lines with the local male English voice.
# SpeakProgress supplies actual word start times rather than even spacing.
Add-Type -AssemblyName System.Speech
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'art-source/audio-source/part2-vo'
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
$lines = @(
  @{ id='p2-1-diagonal'; text='Cut along a diagonal.' },
  @{ id='p2-2-diagonals'; text='Draw all the diagonals.' },
  @{ id='p2-3-samevertex'; text='Draw two diagonals from the same corner.' },
  @{ id='p2-4-concave'; text='Cut the concave polygon.' },
  @{ id='p2-5-convex'; text='Cut the convex polygon.' },
  @{ id='p2-6-concave-pentagon'; text='Cut the concave pentagon.' },
  @{ id='p2-7-convex-hexagon'; text='Cut the convex hexagon.' },
  @{ id='p2-8-all-concave'; text='Cut all the concave ones.' },
  @{ id='p2-9-all-convex'; text='Cut all the convex ones.' },
  @{ id='p2-tut-6-cut'; text='Cut this ice block to fix the path.' }
)
$result = @()
foreach ($line in $lines) {
  $script:wordEvents = New-Object System.Collections.Generic.List[object]
  $speaker = New-Object System.Speech.Synthesis.SpeechSynthesizer
  $speaker.SelectVoice('Microsoft David Desktop')
  $speaker.Rate = 0
  $speaker.Volume = 100
  $speaker.add_SpeakProgress({
    param($sender, $event)
    $script:wordEvents.Add([pscustomobject]@{
      word = $event.Text
      at = [math]::Round($event.AudioPosition.TotalSeconds, 3)
    })
  })
  $file = Join-Path $outDir ($line.id + '.wav')
  $speaker.SetOutputToWaveFile($file)
  $ssml = '<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US"><prosody pitch="+50%">' +
    [System.Security.SecurityElement]::Escape($line.text) + '</prosody></speak>'
  $speaker.SpeakSsml($ssml)
  $speaker.Dispose()
  $dur = [double](& ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 $file)
  $wordCount = ($line.text -split '\s+').Count
  if ($script:wordEvents.Count -ne $wordCount) {
    throw "$($line.id): expected $wordCount word events, got $($script:wordEvents.Count)"
  }
  $result += [pscustomobject]@{
    id = $line.id
    text = $line.text
    file = 'art-source/audio-source/part2-vo/' + $line.id + '.wav'
    duration = [math]::Round($dur, 3)
    words = $script:wordEvents.ToArray()
  }
  Write-Output "$($line.id): $([math]::Round($dur, 2))s, $wordCount words"
}
$result | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath (Join-Path $outDir 'timings.json') -Encoding UTF8
