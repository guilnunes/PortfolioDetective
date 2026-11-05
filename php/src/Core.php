<?php
declare(strict_types=1);

namespace PD;

/**
 * Case logic, ported from packages/core. Chapters, lines and briefs come from data/core.json,
 * generated from the TypeScript sources by `npm run build:php`, so the two never drift.
 */
final class Core
{
    private static ?array $data = null;

    public static function data(): array
    {
        return self::$data ??= Json::decode(file_get_contents(dirname(__DIR__) . '/data/core.json'));
    }

    public static function name(string $lang): string
    {
        return self::data()['names'][$lang] ?? self::data()['names']['pt-BR'];
    }

    public static function line(string $key, string $lang): string
    {
        return self::data()['lines'][$key][$lang] ?? '';
    }

    public static function brief(string $lang, string $mode): string
    {
        return self::data()['briefs'][$lang][$mode] ?? self::data()['briefs']['pt-BR']['full'];
    }

    public static function chapters(): array
    {
        return self::data()['chapters'];
    }

    public static function chapterIds(): array
    {
        return array_column(self::chapters(), 'id');
    }

    public static function chapter(string $id): array
    {
        foreach (self::chapters() as $c) {
            if ($c['id'] === $id) {
                return $c;
            }
        }
        throw new \InvalidArgumentException("Unknown chapter: $id");
    }

    public static function newCase(string $id, string $ownerId, string $title, string $lang): array
    {
        $chapters = [];
        foreach (self::chapterIds() as $cid) {
            $chapters[$cid] = ['id' => $cid, 'state' => 'empty', 'answers' => new \stdClass(), 'reports' => [], 'locked' => false];
        }
        $now = gmdate('c');
        return [
            'id' => $id, 'ownerId' => $ownerId, 'title' => $title, 'caseType' => 'landing-page',
            'caseLanguage' => $lang, 'nda' => ['anonymousClient' => false], 'chapters' => $chapters,
            'evidence' => [], 'caseFiles' => [], 'createdAt' => $now, 'updatedAt' => $now,
        ];
    }

    private static function &ch(array &$case, string $id): array
    {
        self::chapter($id);
        if (!isset($case['chapters'][$id])) {
            throw new \InvalidArgumentException("Case has no chapter $id");
        }
        $case['chapters'][$id]['answers'] = (array) $case['chapters'][$id]['answers'];
        return $case['chapters'][$id];
    }

    public static function recordAnswer(array $case, string $chapter, string $qid, string $text): array
    {
        $def = self::chapter($chapter);
        if (!in_array($qid, array_column($def['questions'], 'id'), true)) {
            throw new \InvalidArgumentException("Chapter $chapter has no question $qid");
        }
        $ch = &self::ch($case, $chapter);
        if ($ch['locked']) {
            throw new \RuntimeException("Chapter $chapter is locked");
        }
        $ch['answers'][$qid] = trim($text);
        if (in_array($ch['state'], ['empty', 'skipped'], true)) {
            $ch['state'] = 'in_progress';
        }
        if ($chapter === 'basics' && $qid === 'name' && trim($text) !== '') {
            $case['title'] = trim($text);
        }
        return $case;
    }

    public static function writeReport(array $case, string $chapter, string $text): array
    {
        $ch = &self::ch($case, $chapter);
        if ($ch['locked']) {
            throw new \RuntimeException("Chapter $chapter is locked");
        }
        $version = count($ch['reports']) ? end($ch['reports'])['version'] + 1 : 1;
        $ch['reports'][] = ['version' => $version, 'text' => $text, 'at' => gmdate('c')];
        if ($ch['state'] === 'empty') {
            $ch['state'] = 'in_progress';
        }
        return $case;
    }

    public static function currentReport(array $case, string $chapter): ?string
    {
        $r = $case['chapters'][$chapter]['reports'] ?? [];
        return $r ? end($r)['text'] : null;
    }

    public static function answer(array $case, string $chapter, string $qid): string
    {
        return trim((string) (((array) ($case['chapters'][$chapter]['answers'] ?? []))[$qid] ?? ''));
    }

    public static function board(array $case, string $lang): array
    {
        $rows = [];
        foreach (self::chapters() as $def) {
            $ch = $case['chapters'][$def['id']];
            $answers = (array) $ch['answers'];
            $rows[] = [
                'number' => $def['number'], 'id' => $def['id'], 'noir' => $def['noir'][$lang], 'step' => $def['step'][$lang],
                'state' => $ch['state'], 'optional' => $def['optional'], 'locked' => $ch['locked'],
                'answered' => count(array_filter($def['questions'], fn($q) => trim((string) ($answers[$q['id']] ?? '')) !== '')),
                'questions' => count($def['questions']), 'hasReport' => count($ch['reports']) > 0,
            ];
        }
        return $rows;
    }

    /** Same rules as looseEnds() in packages/core/src/case.ts. */
    public static function looseEnds(array $case, string $lang): array
    {
        $ends = [];
        $add = function (string $chapter, array $outputs, string $pt, string $en) use (&$ends, $lang): void {
            $ends[] = ['chapter' => $chapter, 'outputs' => $outputs, 'message' => $lang === 'en' ? $en : $pt];
        };
        foreach (self::chapters() as $def) {
            if (in_array($def['id'], ['evidence', 'closing'], true)) {
                continue;
            }
            $ch = $case['chapters'][$def['id']];
            if ($def['optional'] && in_array($ch['state'], ['skipped', 'empty'], true)) {
                continue;
            }
            $answers = (array) $ch['answers'];
            $missing = array_filter($def['questions'], fn($q) => $q['required'] && trim((string) ($answers[$q['id']] ?? '')) === '');
            if ($missing) {
                $add($def['id'], ['behance', 'site'],
                    $def['noir']['pt-BR'] . ': faltam respostas (' . implode(', ', array_map(fn($q) => $q['plain']['pt-BR'], $missing)) . ').',
                    $def['noir']['en'] . ': missing answers (' . implode(', ', array_map(fn($q) => $q['plain']['en'], $missing)) . ').');
            }
            if (!$ch['reports'] && $def['id'] !== 'disguise') {
                $add($def['id'], ['behance', 'site'], $def['noir']['pt-BR'] . ': o relatório ainda não foi escrito.', $def['noir']['en'] . ": the report hasn't been written yet.");
            }
        }
        $results = $case['chapters']['results'];
        if ($results['state'] !== 'skipped' && self::answer($case, 'results', 'proof') === '') {
            $add('results', ['behance', 'site'], 'O veredito: sem provas (números, depoimentos ou prêmios). O case sai, mas fraco.', "The verdict: no proof (numbers, quotes or awards). The case can ship, but it's weak.");
        }
        $shareable = array_filter($case['evidence'], fn($e) => !$e['confidential']);
        if (!$shareable) {
            $add('evidence', ['behance', 'site'], 'As provas: nenhuma imagem que possa ser mostrada.', 'The evidence: no image that can be shown.');
        } elseif (!array_filter($shareable, fn($e) => $e['hero'])) {
            $add('evidence', ['behance', 'site'], 'As provas: falta escolher a imagem principal.', 'The evidence: no hero image chosen.');
        }
        if (empty($case['disguise'])) {
            $add('disguise', ['behance', 'site'], 'O disfarce: estilo visual não definido.', 'The disguise: no visual style set.');
        }
        $modules = $case['direction']['modules'] ?? [];
        if (!array_filter($modules, fn($m) => $m['kind'] === 'cover')) {
            $add('case', ['behance'], 'Falta a capa do Behance.', 'The Behance cover is missing.');
        }
        if (!empty($case['nda']['anonymousClient']) && empty($case['nda']['clientAlias'])) {
            $add('client', ['behance', 'site'], 'O cliente é sigiloso, mas falta um apelido.', 'The client is confidential but has no alias.');
        }
        return $ends;
    }
}
