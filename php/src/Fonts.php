<?php
declare(strict_types=1);

namespace PD;

/**
 * Embeds Google Fonts as data: URIs, because Claude's sandboxed view has no network access
 * and SVG rasterizing can't load external fonts. Cached on disk; any failure falls back to system fonts.
 */
final class Fonts
{
    private const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';

    public function __construct(private string $cacheDir, private bool $enabled = true)
    {
    }

    public function css(array $families): string
    {
        $families = array_values(array_unique(array_filter(array_map('trim', $families))));
        if (!$this->enabled || !$families) {
            return '';
        }
        sort($families);
        $file = rtrim($this->cacheDir, '/') . '/fonts-' . sha1(implode('|', $families)) . '.css';
        if (is_file($file)) {
            return (string) file_get_contents($file);
        }
        $query = implode('&', array_map(fn($f) => 'family=' . str_replace('%20', '+', rawurlencode($f)) . ':wght@400;500;600;700', $families));
        $css = $this->get("https://fonts.googleapis.com/css2?$query&display=swap");
        if ($css === null) {
            return '';
        }
        // Keep only the latin subsets to stay small, then inline each font file.
        $blocks = preg_split('#(?=/\* )#', $css) ?: [];
        $out = '';
        foreach ($blocks as $block) {
            if (!preg_match('#^/\* (latin|latin-ext) \*/#', $block)) {
                continue;
            }
            $block = preg_replace_callback('#url\((https://fonts\.gstatic\.com/[^)]+)\)#', function ($m) {
                $data = $this->get($m[1]);
                return $data === null ? $m[0] : 'url(data:font/woff2;base64,' . base64_encode($data) . ')';
            }, $block);
            $out .= $block;
        }
        if (!is_dir(dirname($file))) {
            mkdir(dirname($file), 0750, true);
        }
        file_put_contents($file, $out);
        return $out;
    }

    private function get(string $url): ?string
    {
        if (!function_exists('curl_init')) {
            return null;
        }
        $ch = curl_init($url);
        curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 8, CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_USERAGENT => self::UA, CURLOPT_FOLLOWLOCATION => true]);
        $body = curl_exec($ch);
        $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ($body !== false && $code === 200) ? (string) $body : null;
    }
}
