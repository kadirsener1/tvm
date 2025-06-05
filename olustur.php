<?php
// Dosya URL'si => kategori adı (boşsa değişiklik yok)
$inputFiles = [
    "https://raw.githubusercontent.com/kadirsener1/CanliTvListe/refs/heads/main/yeni.m3u" => "",
    "https://raw.githubusercontent.com/kadirsener1/CanliTvListe/refs/heads/main/Kanallar/kerim.m3u" => "",
    
];


$kanallar = [];
$m3uIcerik = "#EXTM3U\n";

foreach ($inputFiles as $inputFile => $kategoriAdi) {
    $lines = @file($inputFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if (!$lines) {
        echo "Dosya okunamadı veya bulunamadı: $inputFile<br>";
        continue;
    }

    $buffer = [];
    foreach ($lines as $line) {
        $trimmedLine = trim($line);

        if (strpos($trimmedLine, "#EXTINF:") === 0) {
            if ($kategoriAdi !== "") {
                // Eğer group-title varsa değiştir, yoksa ekle
                if (preg_match('/group-title="[^"]*"/', $trimmedLine)) {
                    $trimmedLine = preg_replace('/group-title="[^"]*"/', 'group-title="' . addslashes($kategoriAdi) . '"', $trimmedLine);
                } else {
                    // group-title yoksa, #EXTINF:-1 kısmından sonra ekle
                    $trimmedLine = preg_replace('/(#EXTINF:-1)/', '$1 group-title="' . addslashes($kategoriAdi) . '"', $trimmedLine);
                }
            }
            $buffer = [$trimmedLine];
        } elseif (strpos($trimmedLine, "#EXTVLCOPT:") === 0) {
            continue;
        } elseif (filter_var($trimmedLine, FILTER_VALIDATE_URL)) {
            $buffer[] = "#EXTVLCOPT:http-user-agent=Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5)";
            $buffer[] = "#EXTVLCOPT:http-referrer=https://trgoals1342.xyz/";
            $buffer[] = $trimmedLine;

            if (strpos($trimmedLine, $arananKelime) !== false) {
                $kanallar[] = $trimmedLine;
                $m3uIcerik .= implode("\n", $buffer) . "\n";
            }
            $buffer = [];
        }
    }
}

file_put_contents("kanallar.m3u", $m3uIcerik);

$veriPHP = "<?php\n\$kanallar = [\n";
foreach ($kanallar as $link) {
    $veriPHP .= "    \"" . addslashes($link) . "\",\n";
}
$veriPHP .= "];\n";

file_put_contents("veriler.php", $veriPHP);

echo "<h2>Toplam " . count($kanallar) . " kanal bulundu</h2>";
foreach ($kanallar as $index => $link) {
    echo '<a href="' . $baseURL . $index . '.m3u8">Kanal #' . ($index + 1) . '</a><br>';
}
?>
