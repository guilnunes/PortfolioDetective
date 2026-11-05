<?php
declare(strict_types=1);

namespace PD;

/** Ported from packages/render/src/pack.ts and baseline evidence checks. */
final class Behance
{
    public static function slug(string $s): string
    {
        $s = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s) ?: $s;
        $s = trim(preg_replace('/[^a-z0-9]+/', '-', strtolower($s)), '-');
        return $s !== '' ? $s : 'case';
    }

    public static function copy(array $case): string
    {
        $en = $case['caseLanguage'] === 'en';
        $t = fn($a, $b) => $en ? $a : $b;
        $description = implode("\n\n", array_filter(array_map(fn($id) => Core::currentReport($case, $id), ['client', 'problem', 'solution', 'results'])));
        $tools = Core::answer($case, 'role', 'tools');
        $credits = implode('. ', array_filter([Core::answer($case, 'role', 'title'), Core::answer($case, 'role', 'team')]));
        $none = $t('(not answered yet)', '(ainda não respondido)');
        return implode("\n", [
            '# ' . $t('Behance fields', 'Campos do Behance'), '',
            '## ' . $t('Project title', 'Título do projeto'), $case['title'], '',
            '## ' . $t('Tagline', 'Subtítulo'), Core::answer($case, 'basics', 'oneLiner'), '',
            '## ' . $t('Project description', 'Descrição do projeto'), $description, '',
            '## Tags', 'landing page, web design, ui design, ux design', '',
            '## ' . $t('Tools used', 'Ferramentas usadas'), $tools !== '' ? $tools : $none, '',
            '## ' . $t('Credits', 'Créditos'), $credits !== '' ? $credits : $none, '',
        ]);
    }

    public static function howTo(bool $en): string
    {
        return $en
            ? "# How to publish on Behance\n\n1. On Behance, click Create a Project.\n2. Upload the images in this folder in order, starting from 01. Do not resize them: they are already 1400px wide.\n3. Open Settings and upload 00-cover.png as the cover image.\n4. Paste the fields from copy.md into title, tags, tools and description.\n5. Publish.\n\nBehance has no publishing API today, so this last step is manual.\n"
            : "# Como publicar no Behance\n\n1. No Behance, clique em Create a Project.\n2. Envie as imagens desta pasta na ordem, a partir da 01. Não redimensione: elas já têm 1400px de largura.\n3. Abra Settings e envie 00-cover.png como capa.\n4. Cole os campos de copy.md em título, tags, ferramentas e descrição.\n5. Publique.\n\nO Behance não tem API de publicação hoje, então este último passo é manual.\n";
    }

    /** Server side checks on module markup before anything is drawn. */
    public static function markupIssues(array $module, array $evidence): array
    {
        $issues = [];
        $text = $module['html'] . "\n" . $module['css'];
        if (preg_match_all('#(?:src|href)\s*=\s*["\']?\s*((?:https?:)?//[^"\'\s>]+)|url\(\s*["\']?((?:https?:)?//[^"\')\s]+)#i', $text, $m)) {
            foreach (array_filter(array_merge($m[1], $m[2])) as $url) {
                $issues[] = ['moduleId' => $module['id'], 'severity' => 'error', 'code' => 'external-resource', 'message' => "External resource not allowed: $url. Only the client's evidence may appear."];
            }
        }
        if (preg_match('#<script|on[a-z]+\s*=#i', $module['html'])) {
            $issues[] = ['moduleId' => $module['id'], 'severity' => 'error', 'code' => 'script', 'message' => 'Scripts and inline event handlers are not allowed.'];
        }
        preg_match_all('/\{\{\s*evidence:([A-Za-z0-9_-]+)\s*\}\}/', $text, $ev);
        foreach (array_unique($ev[1]) as $id) {
            $e = array_values(array_filter($evidence, fn($x) => $x['id'] === $id))[0] ?? null;
            if (!$e) {
                $issues[] = ['moduleId' => $module['id'], 'severity' => 'error', 'code' => 'evidence', 'message' => "Evidence not available: $id."];
            } elseif ($e['confidential']) {
                $issues[] = ['moduleId' => $module['id'], 'severity' => 'error', 'code' => 'evidence', 'message' => "Evidence not available: $id (confidential)."];
            }
        }
        return $issues;
    }

    /** Replaces {{evidence:id}} with data: URIs; confidential or unknown evidence becomes an empty image. */
    public static function inlineEvidence(string $text, array $evidence, Store $store): string
    {
        return preg_replace_callback('/\{\{\s*evidence:([A-Za-z0-9_-]+)\s*\}\}/', function ($m) use ($evidence, $store) {
            foreach ($evidence as $e) {
                if ($e['id'] === $m[1] && !$e['confidential']) {
                    return 'data:' . $e['mime'] . ';base64,' . base64_encode($store->readBlob($e['key']));
                }
            }
            return 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
        }, $text);
    }

    /** @param array<array{id: string, kind: string, key: string}> $renders in layout order */
    public static function pack(array $case, array $renders, array $issues, Store $store): array
    {
        if (!class_exists(\ZipArchive::class)) {
            throw new \RuntimeException('The server is missing the PHP zip extension.');
        }
        $slug = self::slug($case['title'] ?: 'case');
        $tmp = tempnam(sys_get_temp_dir(), 'pd');
        $zip = new \ZipArchive();
        $zip->open($tmp, \ZipArchive::OVERWRITE);
        $n = 0;
        foreach ($renders as $r) {
            $name = $r['kind'] === 'cover' ? '00-cover.png' : sprintf('%02d-%s.png', ++$n, self::slug($r['id']));
            $zip->addFromString("$slug/$name", $store->readBlob($r['key']));
        }
        $en = $case['caseLanguage'] === 'en';
        $zip->addFromString("$slug/copy.md", self::copy($case));
        $zip->addFromString("$slug/" . ($en ? 'HOW-TO-PUBLISH.md' : 'COMO-PUBLICAR.md'), self::howTo($en));
        if ($issues) {
            $zip->addFromString("$slug/quality-report.md", "# Quality report\n\n" . implode("\n", array_map(fn($i) => "- [{$i['severity']}] {$i['moduleId']}: {$i['message']}", $issues)) . "\n");
        }
        $zip->close();
        $data = (string) file_get_contents($tmp);
        unlink($tmp);
        return ['filename' => "$slug-behance.zip", 'data' => $data];
    }
}
