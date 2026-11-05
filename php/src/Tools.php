<?php
declare(strict_types=1);

namespace PD;

/**
 * Every tool the connector offers. Ported from packages/server/src/tools.ts, plus the
 * darkroom tools that let the MCP App view draw the images in the user's browser.
 */
final class Tools
{
    public const VIEW_URI = 'ui://portfolio-detective/darkroom.html';
    private const LANGS = ['pt-BR', 'en'];

    private string $lang;

    public function __construct(
        private Store $store,
        private Auth $auth,
        private Fonts $fonts,
        private array $account,
        private array $profile,
        private string $publicUrl,
    ) {
        $this->lang = $profile['interfaceLanguage'];
    }

    // ---------- schema helpers ----------

    private static function obj(array $props = [], array $required = []): array
    {
        $s = ['type' => 'object', 'properties' => $props ?: new \stdClass()];
        if ($required) {
            $s['required'] = $required;
        }
        return $s;
    }

    private static function str(string $desc = ''): array
    {
        return $desc ? ['type' => 'string', 'description' => $desc] : ['type' => 'string'];
    }

    private static function enum(array $values, string $desc = ''): array
    {
        $s = ['type' => 'string', 'enum' => $values];
        return $desc ? $s + ['description' => $desc] : $s;
    }

    private static function bool(): array
    {
        return ['type' => 'boolean'];
    }

    private static function strings(): array
    {
        return ['type' => 'array', 'items' => ['type' => 'string']];
    }

    // ---------- result helpers ----------

    private static function text(mixed $data, ?array $structured = null): array
    {
        $r = ['content' => [['type' => 'text', 'text' => is_string($data) ? $data : Json::pretty($data)]]];
        if ($structured !== null) {
            $r['structuredContent'] = $structured;
        }
        return $r;
    }

    public static function error(string $message): array
    {
        return ['content' => [['type' => 'text', 'text' => $message]], 'isError' => true];
    }

    // ---------- definitions ----------

    public function definitions(): array
    {
        $chapter = self::enum(Core::chapterIds());
        $lang = self::enum(self::LANGS);
        $caseId = self::str('Case id');
        $tokens = self::obj([
            'colors' => self::obj(['background' => self::str(), 'surface' => self::str(), 'text' => self::str(), 'muted' => self::str(), 'accent' => self::str()], ['background', 'surface', 'text', 'muted', 'accent']),
            'fonts' => self::obj(['heading' => self::str('Google Fonts family'), 'body' => self::str('Google Fonts family')], ['heading', 'body']),
            'mood' => self::str(),
        ], ['colors', 'fonts']);
        $module = self::obj([
            'id' => self::str(), 'kind' => self::enum(['cover', 'section']), 'purpose' => self::str(),
            'html' => self::str('Body of the module; evidence as {{evidence:<id>}}'), 'css' => self::str(), 'locked' => self::bool(),
        ], ['id', 'kind', 'purpose', 'html', 'css']);
        $ro = ['readOnlyHint' => true];
        $ui = ['ui' => ['resourceUri' => self::VIEW_URI], 'ui/resourceUri' => self::VIEW_URI];
        $appOnly = ['ui' => ['resourceUri' => self::VIEW_URI, 'visibility' => ['app']]];

        return [
            ['get_profile', 'Get the client\'s profile', 'The client\'s name, languages and detective mode. Call once at the start of a conversation.', self::obj(), $ro],
            ['set_profile', 'Update the client\'s profile', 'Change interface language, default case language, detective mode (full noir or "facts"), role or portfolio URL.',
                self::obj(['interfaceLanguage' => $lang, 'defaultCaseLanguage' => $lang, 'detectiveMode' => self::enum(['full', 'facts']), 'role' => self::str(), 'portfolioUrl' => self::str()])],
            ['list_cases', 'List the client\'s cases', 'All cases this client has opened, with their state.', self::obj(), $ro],
            ['open_case', 'Open a new case', 'Start a new case file. Returns the case id and the opening line.',
                self::obj(['title' => self::str('Project name, if already known'), 'caseLanguage' => self::enum(self::LANGS, 'Language of the exported case')])],
            ['open_sample_case', 'Open the sample case', 'Opens a copy of a fictional, fully answered landing page case (Maré Cold Brew) with evidence, to try the layout and darkroom without an interrogation.', self::obj()],
            ['get_case_board', 'Get the case board', 'Chapters with their states, answers, reports, and the loose ends for each output.', self::obj(['caseId' => $caseId], ['caseId']), $ro],
            ['get_chapter', 'Get a chapter\'s script', 'The questions for a chapter, in character and in plain form, plus current answers and report.', self::obj(['caseId' => $caseId, 'chapter' => $chapter], ['caseId', 'chapter']), $ro],
            ['record_answer', 'Record an answer', 'Save the client\'s answer to one question, in the client\'s own words. Do not polish it.',
                self::obj(['caseId' => $caseId, 'chapter' => $chapter, 'questionId' => self::str(), 'answer' => self::str()], ['caseId', 'chapter', 'questionId', 'answer'])],
            ['write_report', 'Write a chapter report', 'Save the detective\'s typed report for a chapter, in the case language. Only from the client\'s answers. Creates a new version.',
                self::obj(['caseId' => $caseId, 'chapter' => $chapter, 'report' => self::str()], ['caseId', 'chapter', 'report'])],
            ['set_chapter_state', 'Close, skip or reopen a chapter', 'Set a chapter\'s state, and optionally lock it so it is not changed again.',
                self::obj(['caseId' => $caseId, 'chapter' => $chapter, 'state' => self::enum(['empty', 'in_progress', 'closed', 'skipped']), 'locked' => self::bool()], ['caseId', 'chapter'])],
            ['set_case_settings', 'Case settings', 'Title, case language, and NDA: whether the client is anonymous and the alias to use.',
                self::obj(['caseId' => $caseId, 'title' => self::str(), 'caseLanguage' => $lang, 'anonymousClient' => self::bool(), 'clientAlias' => self::str()], ['caseId'])],
            ['get_upload_link', 'Get an evidence upload link', 'A link the client opens to drop images (screens, photos, sketches) into the case. Valid for 2 hours.',
                self::obj(['caseId' => $caseId, 'chapter' => $chapter], ['caseId']), $ro],
            ['list_evidence', 'List the evidence', 'Images pinned to the case, with ids to use as {{evidence:<id>}}.', self::obj(['caseId' => $caseId], ['caseId']), $ro],
            ['view_evidence', 'Look at a piece of evidence', 'Returns the image so you can see it before writing alt text or planning the layout.',
                self::obj(['caseId' => $caseId, 'evidenceId' => self::str()], ['caseId', 'evidenceId']), $ro],
            ['update_evidence', 'Update evidence', 'Set alt text, caption, chapter, hero or confidential on an image. Only one hero per case.',
                self::obj(['caseId' => $caseId, 'evidenceId' => self::str(), 'alt' => self::str(), 'caption' => self::str(), 'chapter' => $chapter, 'hero' => self::bool(), 'confidential' => self::bool()], ['caseId', 'evidenceId'])],
            ['set_disguise', 'Set the visual style (the disguise)', 'Style tokens for the case: colors (#rrggbb), Google Fonts names, mood words, and where they came from.',
                self::obj(['caseId' => $caseId, 'source' => self::enum(['own-site', 'suggested', 'described']), 'siteUrl' => self::str(), 'description' => self::str(), 'tokens' => $tokens], ['caseId', 'source', 'tokens'])],
            ['get_art_direction_guide', 'Get the art direction guide', 'Guidance, hard rules and the critique rubric for laying out the case. Read before direct_layout.', self::obj(), $ro],
            ['get_layout', 'Get the current layout', 'The art direction brief and modules. With baseline=true on the sample case, returns a plain draft made without AI, for reference only.',
                self::obj(['caseId' => $caseId, 'baseline' => self::bool()], ['caseId']), $ro],
            ['direct_layout', 'Direct the layout', 'Save the art direction brief and modules. Modules with an existing id are replaced, unless locked; new ids are added. "order" sets the final sequence.',
                self::obj(['caseId' => $caseId, 'brief' => self::str(), 'modules' => ['type' => 'array', 'items' => $module], 'order' => self::strings(), 'remove' => self::strings()], ['caseId', 'modules'])],
            ['preview_layout', 'Develop the layout in the darkroom', 'Opens the darkroom view, which draws every module in the client\'s browser exactly as it will ship, checks quality and files the images. When it finishes, call get_review.',
                self::obj(['caseId' => $caseId], ['caseId']), null, $ui],
            ['get_review', 'Review the developed images', 'The images from the last darkroom run plus the quality issues. Look at them as a critic who did not build them. Up to 6 per call; use "only" to pick.',
                self::obj(['caseId' => $caseId, 'only' => self::strings()], ['caseId']), $ro],
            ['close_case', 'Close the case (export)', 'Package the Behance pack (images, copy to paste, how to publish) from the last darkroom run. Returns a download link valid for 7 days.',
                self::obj(['caseId' => $caseId], ['caseId'])],
            ['export_claude_design_brief', 'Case file for Claude Design', 'A prompt pack to paste into Claude Design, with the list of evidence files to attach.', self::obj(['caseId' => $caseId], ['caseId']), $ro],
            // App-only tools, called by the darkroom view.
            ['get_render_job', 'Darkroom: get the render job', 'Modules, tokens and fonts for the view.', self::obj(['caseId' => $caseId], ['caseId']), $ro, $appOnly],
            ['save_render', 'Darkroom: file one print', 'Stores one rendered module.', self::obj([
                'caseId' => $caseId, 'renderId' => self::str(), 'moduleId' => self::str(), 'png' => self::str('base64'),
                'width' => ['type' => 'integer'], 'height' => ['type' => 'integer'], 'issues' => ['type' => 'array', 'items' => ['type' => 'object']],
            ], ['caseId', 'renderId', 'moduleId', 'png', 'width', 'height']), null, $appOnly],
            ['finish_render', 'Darkroom: finish the run', 'Marks the run complete with its issues.', self::obj([
                'caseId' => $caseId, 'renderId' => self::str(), 'issues' => ['type' => 'array', 'items' => ['type' => 'object']],
            ], ['caseId', 'renderId']), null, $appOnly],
        ];
    }

    public function list(): array
    {
        return array_map(function ($d) {
            [$name, $title, $description, $schema] = $d;
            $t = ['name' => $name, 'title' => $title, 'description' => $description, 'inputSchema' => $schema];
            if (!empty($d[4])) {
                $t['annotations'] = $d[4];
            }
            if (!empty($d[5])) {
                $t['_meta'] = $d[5];
            }
            return $t;
        }, $this->definitions());
    }

    public function call(string $name, array $args): array
    {
        $method = 't_' . $name;
        if (!in_array($name, array_column($this->definitions(), 0), true) || !method_exists($this, $method)) {
            return self::error("Unknown tool: $name");
        }
        try {
            return $this->$method($args);
        } catch (\Throwable $e) {
            return self::error($e->getMessage());
        }
    }

    // ---------- helpers ----------

    private function load(array $args): array
    {
        $id = (string) ($args['caseId'] ?? '');
        $case = $id !== '' ? $this->store->getCase($this->account['id'], $id) : null;
        if (!$case) {
            throw new \RuntimeException("Case not found: $id");
        }
        return $case;
    }

    private function save(array $case): void
    {
        $this->store->saveCase($case);
    }

    private static function newId(): string
    {
        return substr(bin2hex(random_bytes(6)), 0, 8);
    }

    // ---------- profile and cases ----------

    private function t_get_profile(array $a): array
    {
        return self::text($this->profile);
    }

    private function t_set_profile(array $a): array
    {
        foreach (['interfaceLanguage', 'defaultCaseLanguage', 'detectiveMode', 'role', 'portfolioUrl'] as $k) {
            if (isset($a[$k])) {
                $this->profile[$k] = $a[$k];
            }
        }
        $this->store->saveUser($this->profile);
        return self::text($this->profile);
    }

    private function t_list_cases(array $a): array
    {
        return self::text(array_map(fn($c) => [
            'id' => $c['id'], 'title' => $c['title'] ?: '(untitled)', 'updatedAt' => $c['updatedAt'],
            'looseEnds' => count(Core::looseEnds($c, $this->lang)),
        ], $this->store->listCases($this->account['id'])));
    }

    private function t_open_case(array $a): array
    {
        $case = Core::newCase(self::newId(), $this->account['id'], (string) ($a['title'] ?? ''), $a['caseLanguage'] ?? $this->profile['defaultCaseLanguage']);
        if (!empty($a['title'])) {
            $case = Core::recordAnswer($case, 'basics', 'name', (string) $a['title']);
        }
        $this->save($case);
        return self::text(['caseId' => $case['id'], 'opening' => Core::line('opening', $this->lang), 'board' => Core::board($case, $this->lang)]);
    }

    private function t_open_sample_case(array $a): array
    {
        $case = Json::decode(file_get_contents(dirname(__DIR__) . '/fixtures/sample-case.json'));
        $case['id'] = 'sample-' . self::newId();
        $case['ownerId'] = $this->account['id'];
        unset($case['direction']);
        $this->save($case);
        return self::text([
            'caseId' => $case['id'], 'title' => $case['title'],
            'note' => 'Fictional sample case, fully answered, with three pieces of evidence and a disguise. Ready for art direction.',
            'looseEnds' => array_column(Core::looseEnds($case, $this->lang), 'message'),
        ]);
    }

    private function t_get_case_board(array $a): array
    {
        $c = $this->load($a);
        return self::text([
            'title' => $c['title'], 'caseLanguage' => $c['caseLanguage'], 'nda' => $c['nda'],
            'board' => Core::board($c, $this->lang),
            'looseEnds' => Core::looseEnds($c, $this->lang),
            'evidence' => count($c['evidence']), 'hasDisguise' => !empty($c['disguise']),
            'modules' => count($c['direction']['modules'] ?? []),
            'lastRender' => isset($c['render']) ? ['status' => $c['render']['status'], 'current' => $this->renderIsCurrent($c)] : null,
        ]);
    }

    private function t_get_chapter(array $a): array
    {
        $c = $this->load($a);
        $def = Core::chapter((string) $a['chapter']);
        $ch = $c['chapters'][$def['id']];
        $answers = (array) $ch['answers'];
        $mode = $this->profile['detectiveMode'] === 'facts' ? 'plain' : 'ask';
        return self::text([
            'number' => $def['number'], 'noir' => $def['noir'][$this->lang], 'step' => $def['step'][$this->lang],
            'optional' => $def['optional'], 'state' => $ch['state'], 'locked' => $ch['locked'], 'reportGuide' => $def['reportGuide'],
            'questions' => array_map(fn($q) => ['id' => $q['id'], 'ask' => $q[$mode][$this->lang], 'required' => $q['required'], 'answer' => $answers[$q['id']] ?? null], $def['questions']),
            'report' => Core::currentReport($c, $def['id']),
        ]);
    }

    private function t_record_answer(array $a): array
    {
        $c = Core::recordAnswer($this->load($a), (string) $a['chapter'], (string) $a['questionId'], (string) $a['answer']);
        $this->save($c);
        $def = Core::chapter((string) $a['chapter']);
        $answers = (array) $c['chapters'][$def['id']]['answers'];
        $next = null;
        foreach ($def['questions'] as $q) {
            if (trim((string) ($answers[$q['id']] ?? '')) === '') {
                $next = $q['id'];
                break;
            }
        }
        return self::text(['saved' => true, 'nextQuestion' => $next]);
    }

    private function t_write_report(array $a): array
    {
        $c = Core::writeReport($this->load($a), (string) $a['chapter'], (string) $a['report']);
        $this->save($c);
        return self::text(['saved' => true, 'version' => count($c['chapters'][$a['chapter']]['reports'])]);
    }

    private function t_set_chapter_state(array $a): array
    {
        $c = $this->load($a);
        $id = (string) $a['chapter'];
        Core::chapter($id);
        if (isset($a['state'])) {
            $c['chapters'][$id]['state'] = $a['state'];
        }
        if (isset($a['locked'])) {
            $c['chapters'][$id]['locked'] = (bool) $a['locked'];
        }
        $this->save($c);
        return self::text(['chapter' => $id, 'state' => $c['chapters'][$id]['state'], 'locked' => $c['chapters'][$id]['locked'],
            'line' => ($a['state'] ?? '') === 'closed' ? Core::line('chapterClosed', $this->lang) : null]);
    }

    private function t_set_case_settings(array $a): array
    {
        $c = $this->load($a);
        if (!empty($a['title'])) {
            $c['title'] = (string) $a['title'];
        }
        if (isset($a['caseLanguage'])) {
            $c['caseLanguage'] = $a['caseLanguage'];
        }
        if (isset($a['anonymousClient'])) {
            $c['nda']['anonymousClient'] = (bool) $a['anonymousClient'];
        }
        if (isset($a['clientAlias'])) {
            $c['nda']['clientAlias'] = (string) $a['clientAlias'];
        }
        $this->save($c);
        return self::text(['title' => $c['title'], 'caseLanguage' => $c['caseLanguage'], 'nda' => $c['nda']]);
    }

    // ---------- evidence ----------

    private function t_get_upload_link(array $a): array
    {
        $c = $this->load($a);
        $token = $this->auth->sign(['u' => $this->account['id'], 'c' => $c['id'], 'ch' => $a['chapter'] ?? '', 'l' => $this->lang], 7200);
        return self::text(['url' => "{$this->publicUrl}/evidence/$token", 'line' => $this->lang === 'pt-BR' ? 'Joga as provas aqui.' : 'Drop the evidence here.']);
    }

    private function t_list_evidence(array $a): array
    {
        return self::text(array_map(function ($e) {
            unset($e['key']);
            return $e;
        }, $this->load($a)['evidence']));
    }

    private function t_view_evidence(array $a): array
    {
        $c = $this->load($a);
        foreach ($c['evidence'] as $e) {
            if ($e['id'] === ($a['evidenceId'] ?? '')) {
                return ['content' => [
                    ['type' => 'image', 'data' => base64_encode($this->store->readBlob($e['key'])), 'mimeType' => $e['mime']],
                    ['type' => 'text', 'text' => Json::encode(['id' => $e['id'], 'width' => $e['width'] ?? null, 'height' => $e['height'] ?? null, 'alt' => $e['alt']])],
                ]];
            }
        }
        return self::error('No evidence ' . ($a['evidenceId'] ?? ''));
    }

    private function t_update_evidence(array $a): array
    {
        $c = $this->load($a);
        $found = null;
        foreach ($c['evidence'] as $i => $e) {
            if ($e['id'] === ($a['evidenceId'] ?? '')) {
                $found = $i;
            }
        }
        if ($found === null) {
            return self::error('No evidence ' . ($a['evidenceId'] ?? ''));
        }
        if (!empty($a['hero'])) {
            foreach ($c['evidence'] as $i => $_) {
                $c['evidence'][$i]['hero'] = false;
            }
        }
        foreach (['alt', 'caption', 'chapter', 'hero', 'confidential'] as $k) {
            if (array_key_exists($k, $a)) {
                $c['evidence'][$found][$k] = $a[$k];
            }
        }
        $this->save($c);
        $e = $c['evidence'][$found];
        unset($e['key']);
        return self::text($e);
    }

    // ---------- style and layout ----------

    private static function contrast(string $a, string $b): ?float
    {
        $rgb = function (string $h): ?array {
            $h = ltrim(trim($h), '#');
            if (strlen($h) === 3) {
                $h = $h[0] . $h[0] . $h[1] . $h[1] . $h[2] . $h[2];
            }
            return preg_match('/^[0-9a-f]{6}$/i', $h) ? array_map('hexdec', str_split($h, 2)) : null;
        };
        $lum = fn(array $c) => array_sum(array_map(fn($v, $w) => $w * (($s = $v / 255) <= 0.03928 ? $s / 12.92 : (($s + 0.055) / 1.055) ** 2.4), $c, [0.2126, 0.7152, 0.0722]));
        $x = $rgb($a);
        $y = $rgb($b);
        if (!$x || !$y) {
            return null;
        }
        $l = [$lum($x), $lum($y)];
        rsort($l);
        return ($l[0] + 0.05) / ($l[1] + 0.05);
    }

    private function tokenIssues(array $tokens): array
    {
        $issues = [];
        $min = Core::data()['minContrast'];
        foreach ([['text', 'background'], ['text', 'surface']] as [$fg, $bg]) {
            $r = self::contrast($tokens['colors'][$fg] ?? '', $tokens['colors'][$bg] ?? '');
            if ($r === null) {
                $issues[] = ['moduleId' => 'tokens', 'severity' => 'warning', 'code' => 'color-format', 'message' => "Could not read colors for $fg on $bg; use #rrggbb."];
            } elseif ($r < $min) {
                $issues[] = ['moduleId' => 'tokens', 'severity' => 'error', 'code' => 'contrast', 'message' => sprintf('Contrast for %s on %s is %.2f:1, below %.1f:1.', $fg, $bg, $r, $min)];
            }
        }
        return $issues;
    }

    private function t_set_disguise(array $a): array
    {
        $c = $this->load($a);
        $c['disguise'] = array_filter(['source' => $a['source'], 'siteUrl' => $a['siteUrl'] ?? null, 'description' => $a['description'] ?? null, 'tokens' => $a['tokens']], fn($v) => $v !== null);
        $c['chapters']['disguise']['state'] = 'closed';
        $this->save($c);
        return self::text(['saved' => true, 'issues' => $this->tokenIssues($a['tokens'])]);
    }

    private function t_get_art_direction_guide(array $a): array
    {
        $s = Core::data()['skills'];
        return self::text($s['landingPageCase'] . "\n\n---\n\n" . $s['behancePack']
            . "\n\n---\n\nIn this connector the render loop is: direct_layout, then preview_layout (the darkroom view draws and checks every module in the client's browser), then get_review to see the images and issues.");
    }

    private function t_get_layout(array $a): array
    {
        $c = $this->load($a);
        if (!empty($a['baseline'])) {
            if (!str_starts_with($c['id'], 'sample-')) {
                return self::error('A baseline draft exists only for the sample case. Design the layout from the guide.');
            }
            return self::text(Json::decode(file_get_contents(dirname(__DIR__) . '/fixtures/sample-baseline.json')));
        }
        return self::text($c['direction'] ?? ['brief' => '', 'modules' => []]);
    }

    private function t_direct_layout(array $a): array
    {
        $c = $this->load($a);
        $d = $c['direction'] ?? ['brief' => '', 'modules' => [], 'updatedAt' => ''];
        $skipped = [];
        $issues = [];
        foreach ($a['modules'] ?? [] as $m) {
            foreach (['id', 'kind', 'html', 'css'] as $k) {
                if (!isset($m[$k]) || !is_string($m[$k])) {
                    return self::error("Every module needs id, kind, purpose, html and css (missing $k).");
                }
            }
            if (!preg_match('/^[A-Za-z0-9_-]{1,40}$/', $m['id']) || !in_array($m['kind'], ['cover', 'section'], true)) {
                return self::error("Bad module id or kind: {$m['id']}");
            }
            $idx = null;
            foreach ($d['modules'] as $i => $x) {
                if ($x['id'] === $m['id']) {
                    $idx = $i;
                }
            }
            if ($idx !== null && $d['modules'][$idx]['locked']) {
                $skipped[] = $m['id'];
                continue;
            }
            $next = ['id' => $m['id'], 'kind' => $m['kind'], 'purpose' => (string) ($m['purpose'] ?? ''), 'html' => $m['html'], 'css' => $m['css'], 'locked' => (bool) ($m['locked'] ?? false)];
            $issues = array_merge($issues, Behance::markupIssues($next, $c['evidence']));
            if ($idx !== null) {
                $d['modules'][$idx] = $next;
            } else {
                $d['modules'][] = $next;
            }
        }
        if (!empty($a['remove'])) {
            $d['modules'] = array_values(array_filter($d['modules'], fn($m) => $m['locked'] || !in_array($m['id'], $a['remove'], true)));
        }
        if (!empty($a['order'])) {
            $pos = array_flip($a['order']);
            usort($d['modules'], fn($x, $y) => ($pos[$x['id']] ?? 999) <=> ($pos[$y['id']] ?? 999));
        }
        if (!empty($a['brief'])) {
            $d['brief'] = (string) $a['brief'];
        }
        $d['updatedAt'] = gmdate('c') . '#' . self::newId();
        $c['direction'] = $d;
        $this->save($c);
        return self::text([
            'modules' => array_map(fn($m) => ['id' => $m['id'], 'kind' => $m['kind'], 'locked' => $m['locked']], $d['modules']),
            'skippedLocked' => $skipped, 'issues' => $issues,
            'next' => 'Call preview_layout to develop the images in the darkroom.',
        ]);
    }

    // ---------- darkroom ----------

    private function renderIsCurrent(array $c): bool
    {
        return isset($c['render'], $c['direction'])
            && $c['render']['status'] === 'done'
            && $c['render']['layoutAt'] === $c['direction']['updatedAt'];
    }

    private function t_preview_layout(array $a): array
    {
        $c = $this->load($a);
        if (empty($c['direction']['modules'])) {
            return self::error('No layout yet. Call direct_layout first.');
        }
        if (empty($c['disguise'])) {
            return self::error('No disguise yet. Call set_disguise first.');
        }
        $renderId = self::newId();
        $c['render'] = ['id' => $renderId, 'layoutAt' => $c['direction']['updatedAt'], 'status' => 'pending', 'modules' => new \stdClass(), 'issues' => [], 'startedAt' => gmdate('c')];
        $this->save($c);
        $n = count($c['direction']['modules']);
        $msg = $this->lang === 'en'
            ? "The darkroom is developing $n modules in the client's browser. When it finishes, it posts a message in the chat; then call get_review. If no view appears, the client needs Claude on the web, desktop or mobile app with interactive connectors."
            : "A sala de revelação está revelando $n módulos no navegador do cliente. Quando terminar, ela manda uma mensagem no chat; aí chame get_review. Se nenhuma janela aparecer, o cliente precisa usar o Claude na web, no app desktop ou no celular, com conectores interativos.";
        return self::text($msg, ['caseId' => $c['id'], 'renderId' => $renderId, 'lang' => $this->lang, 'detective' => Core::name($this->lang)]);
    }

    private function t_get_render_job(array $a): array
    {
        $c = $this->load($a);
        if (empty($c['render']) || empty($c['direction']['modules']) || empty($c['disguise'])) {
            return self::error('Nothing to develop. Ask the detective to direct the layout first.');
        }
        $spec = Core::data()['behance'];
        $tokens = $c['disguise']['tokens'];
        $serverIssues = $this->tokenIssues($tokens);
        $modules = [];
        foreach ($c['direction']['modules'] as $m) {
            $serverIssues = array_merge($serverIssues, Behance::markupIssues($m, $c['evidence']));
            $modules[] = [
                'id' => $m['id'], 'kind' => $m['kind'],
                'html' => Behance::inlineEvidence($m['html'], $c['evidence'], $this->store),
                'css' => Behance::inlineEvidence($m['css'], $c['evidence'], $this->store),
            ];
        }
        $job = [
            'caseId' => $c['id'], 'renderId' => $c['render']['id'], 'title' => $c['title'], 'lang' => $this->lang,
            'detective' => Core::name($this->lang), 'spec' => $spec, 'tokens' => $tokens,
            'fontCss' => $this->fonts->css([$tokens['fonts']['heading'] ?? '', $tokens['fonts']['body'] ?? '']),
            'modules' => $modules, 'serverIssues' => $serverIssues,
        ];
        return self::text('Render job for ' . count($modules) . ' modules.', $job);
    }

    private function t_save_render(array $a): array
    {
        $c = $this->load($a);
        if (($c['render']['id'] ?? null) !== ($a['renderId'] ?? '')) {
            return self::error('This darkroom run is out of date. Develop again.');
        }
        $png = base64_decode((string) $a['png'], true);
        if ($png === false || !str_starts_with($png, "\x89PNG") || strlen($png) > 12 * 1024 * 1024) {
            return self::error('Not a valid PNG (or larger than 12 MB).');
        }
        $moduleIds = array_column($c['direction']['modules'], 'id');
        if (!in_array($a['moduleId'], $moduleIds, true)) {
            return self::error('Unknown module ' . $a['moduleId']);
        }
        $key = $this->store->putBlob("renders/{$c['ownerId']}/{$c['id']}", "{$c['render']['id']}-{$a['moduleId']}.png", $png);
        $modules = (array) $c['render']['modules'];
        $modules[$a['moduleId']] = ['key' => $key, 'width' => (int) $a['width'], 'height' => (int) $a['height'], 'issues' => $a['issues'] ?? []];
        $c['render']['modules'] = $modules;
        $this->save($c);
        return self::text('Filed.', ['saved' => $a['moduleId']]);
    }

    private function t_finish_render(array $a): array
    {
        $c = $this->load($a);
        if (($c['render']['id'] ?? null) !== ($a['renderId'] ?? '')) {
            return self::error('This darkroom run is out of date. Develop again.');
        }
        $c['render']['status'] = 'done';
        $c['render']['issues'] = array_values(array_slice($a['issues'] ?? [], 0, 200));
        $c['render']['finishedAt'] = gmdate('c');
        $this->save($c);
        return self::text('Done.', ['modules' => count((array) $c['render']['modules'])]);
    }

    private function t_get_review(array $a): array
    {
        $c = $this->load($a);
        if (empty($c['render']) || $c['render']['status'] !== 'done') {
            return self::error('No finished darkroom run yet. Call preview_layout and wait for it to finish.');
        }
        $stale = !$this->renderIsCurrent($c);
        $rendered = (array) $c['render']['modules'];
        $order = array_column($c['direction']['modules'], 'id');
        $ids = !empty($a['only']) ? array_values(array_intersect($order, $a['only'])) : $order;
        $content = [];
        $shown = 0;
        $rest = [];
        foreach ($ids as $id) {
            if (!isset($rendered[$id])) {
                $rest[] = "$id (not rendered)";
                continue;
            }
            if ($shown >= 6) {
                $rest[] = $id;
                continue;
            }
            $r = $rendered[$id];
            $content[] = ['type' => 'text', 'text' => "Module $id, {$r['width']}x{$r['height']}"];
            $content[] = ['type' => 'image', 'data' => base64_encode($this->store->readBlob($r['key'])), 'mimeType' => 'image/png'];
            $shown++;
        }
        $content[] = ['type' => 'text', 'text' => Json::pretty([
            'issues' => $c['render']['issues'], 'notShownYet' => $rest,
            'stale' => $stale ? 'The layout changed after this run. Call preview_layout again before closing the case.' : false,
        ])];
        return ['content' => $content];
    }

    private function t_close_case(array $a): array
    {
        $c = $this->load($a);
        if (!$this->renderIsCurrent($c)) {
            return self::error('Develop the current layout first: call preview_layout, wait for the darkroom, then close the case.');
        }
        $rendered = (array) $c['render']['modules'];
        $renders = [];
        foreach ($c['direction']['modules'] as $m) {
            if (!isset($rendered[$m['id']])) {
                return self::error("Module {$m['id']} was not developed. Develop again.");
            }
            $renders[] = ['id' => $m['id'], 'kind' => $m['kind'], 'key' => $rendered[$m['id']]['key']];
        }
        $issues = $c['render']['issues'];
        $pack = Behance::pack($c, $renders, $issues, $this->store);
        $key = $this->store->putBlob("files/{$c['ownerId']}/{$c['id']}", self::newId() . '.zip', $pack['data']);
        $c['caseFiles'][] = ['id' => self::newId(), 'output' => 'behance', 'key' => $key, 'createdAt' => gmdate('c')];
        $c['chapters']['closing']['state'] = 'closed';
        $this->save($c);
        $errors = array_values(array_filter($issues, fn($i) => ($i['severity'] ?? '') === 'error'));
        $token = $this->auth->sign(['u' => $this->account['id'], 'k' => $key, 'f' => $pack['filename']], 7 * 86400);
        return self::text([
            'line' => Core::line($errors ? 'looseEnds' : 'caseClosed', $this->lang),
            'download' => "{$this->publicUrl}/files/$token", 'images' => count($renders), 'errors' => $errors,
            'looseEnds' => array_column(Core::looseEnds($c, $this->lang), 'message'),
        ]);
    }

    private function t_export_claude_design_brief(array $a): array
    {
        $c = $this->load($a);
        $t = $c['disguise']['tokens'] ?? null;
        $story = [];
        foreach (Core::chapters() as $d) {
            if (in_array($d['id'], ['evidence', 'disguise', 'closing'], true)) {
                continue;
            }
            $r = Core::currentReport($c, $d['id']);
            if ($r) {
                $story[] = "### {$d['step']['en']}\n$r";
            }
        }
        $ev = array_map(fn($e) => "- {$e['filename']}" . ($e['hero'] ? ' (hero)' : '') . ": {$e['alt']}", array_filter($c['evidence'], fn($e) => !$e['confidential']));
        $lines = [
            "# Portfolio case for Claude Design: {$c['title']}", '',
            'Paste this into a new Claude Design project and attach the evidence files listed below.', '',
            '## What to make', '',
            '1. A Behance project: a cover at 808x632 and a sequence of 1400px wide images that tell the case below. Show the work bigger than the words.',
            '2. A single case study web page for the same project, using the same visual direction.', '',
            '## Rules', '',
            '- Use only the attached images. Do not invent screens, metrics, quotes or results.',
            !empty($c['nda']['anonymousClient']) ? '- The client is confidential. Call them "' . ($c['nda']['clientAlias'] ?? 'the client') . '".' : '- The client can be named.',
            '- Write all copy in ' . ($c['caseLanguage'] === 'en' ? 'English' : 'Brazilian Portuguese') . ', short and plain.',
            '- Body text large enough to read on a phone when the image is scaled down.', '',
            '## Visual direction', '',
            $t ? "- Mood: " . ($t['mood'] ?? 'not given') . "\n- Colors: background {$t['colors']['background']}, surface {$t['colors']['surface']}, text {$t['colors']['text']}, muted {$t['colors']['muted']}, accent {$t['colors']['accent']}\n- Fonts: headings {$t['fonts']['heading']}, body {$t['fonts']['body']}" : '- Not set yet. Propose a direction that fits the project.',
            '', '## Evidence to attach', '', ...$ev, '', '## The case', '', implode("\n\n", $story), '',
        ];
        return self::text(implode("\n", $lines));
    }
}
