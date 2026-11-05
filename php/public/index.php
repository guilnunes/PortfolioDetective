<?php
declare(strict_types=1);

/*
 * Portfolio Detective front controller (HostGator / any PHP 8.2+ host).
 * The subdomain's document root points at this folder; everything else lives one level up.
 */

use PD\{Auth, Core, Fonts, Json, Mcp, Pages, Store, Tools};

$base = dirname(__DIR__);
spl_autoload_register(function (string $class) use ($base) {
    if (str_starts_with($class, 'PD\\')) {
        require $base . '/src/' . substr($class, 3) . '.php';
    }
});

$configFile = getenv('PD_CONFIG') ?: $base . '/config.php';
if (!is_file($configFile)) {
    http_response_code(500);
    exit('Missing config.php. Copy config.example.php and fill it in.');
}
$config = require $configFile;
$publicUrl = rtrim($config['public_url'], '/');

function respond(int $status, string $type, string $body, array $headers = []): never
{
    http_response_code($status);
    header("Content-Type: $type");
    header('X-Content-Type-Options: nosniff');
    foreach ($headers as $k => $v) {
        header("$k: $v");
    }
    echo $body;
    exit;
}

function json_out(int $status, mixed $data): never
{
    respond($status, 'application/json', Json::encode($data));
}

$path = '/' . trim((string) parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH), '/');
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

try {
    $store = new Store($config['db'], $config['storage_dir']);
    $auth = new Auth($config['users'], $config['secret']);
} catch (Throwable $e) {
    json_out(500, ['error' => 'Server not configured: ' . $e->getMessage()]);
}

if ($path === '/health') {
    json_out(200, ['ok' => true, 'php' => PHP_VERSION, 'zip' => class_exists(ZipArchive::class)]);
}

if ($path === '/') {
    respond(200, 'text/plain; charset=utf-8', 'Portfolio Detective. ' . Core::name('pt-BR') . ' / ' . Core::name('en') . " is in.\nConnector URL: $publicUrl/mcp\n");
}

// Door A: the Claude connector.
if ($path === '/mcp') {
    if ($method !== 'POST') {
        respond(405, 'application/json', Json::encode(['jsonrpc' => '2.0', 'error' => ['code' => -32000, 'message' => 'Method not allowed'], 'id' => null]), ['Allow' => 'POST']);
    }
    $account = $auth->account(Auth::bearer());
    if (!$account) {
        json_out(401, ['jsonrpc' => '2.0', 'error' => ['code' => -32001, 'message' => 'Unknown or missing token'], 'id' => null]);
    }
    $profile = $store->getUser($account['id']);
    if (!$profile) {
        $profile = ['id' => $account['id'], 'name' => $account['name'], 'interfaceLanguage' => 'pt-BR', 'defaultCaseLanguage' => 'en', 'detectiveMode' => 'full', 'links' => new stdClass()];
        $store->saveUser($profile);
    }
    try {
        $msg = Json::decode((string) file_get_contents('php://input'));
    } catch (Throwable) {
        json_out(400, ['jsonrpc' => '2.0', 'error' => ['code' => -32700, 'message' => 'Parse error'], 'id' => null]);
    }
    if (!is_array($msg) || array_is_list($msg)) {
        json_out(400, ['jsonrpc' => '2.0', 'error' => ['code' => -32600, 'message' => 'Send one JSON-RPC message per request'], 'id' => null]);
    }
    $fonts = new Fonts($config['storage_dir'] . '/cache', $config['web_fonts'] ?? true);
    $tools = new Tools($store, $auth, $fonts, $account, $profile, $publicUrl);
    [$status, $body] = (new Mcp($tools, $profile))->handle($msg);
    if ($body === null) {
        http_response_code($status);
        exit;
    }
    json_out($status, $body);
}

// Evidence upload page, through signed links from get_upload_link.
if (preg_match('#^/evidence/([A-Za-z0-9_.-]+)$#', $path, $m)) {
    $data = $auth->verify($m[1]);
    if ($method === 'GET') {
        if (!$data) {
            respond(410, 'text/plain; charset=utf-8', 'This link expired. Ask the detective for a new one.');
        }
        respond(200, 'text/html; charset=utf-8', Pages::upload(in_array($data['l'] ?? '', ['pt-BR', 'en'], true) ? $data['l'] : 'pt-BR'));
    }
    if ($method === 'POST') {
        if (!$data || empty($data['u']) || empty($data['c'])) {
            json_out(410, ['error' => 'expired']);
        }
        $raw = (string) file_get_contents('php://input');
        if (strlen($raw) > 20 * 1024 * 1024) {
            json_out(413, ['error' => 'File larger than 20 MB']);
        }
        $info = Pages::imageInfo($raw);
        if (!$info) {
            json_out(415, ['error' => 'PNG, JPG, GIF or WebP only']);
        }
        $case = $store->getCase($data['u'], $data['c']);
        if (!$case) {
            json_out(404, ['error' => 'case not found']);
        }
        $filename = mb_substr(rawurldecode($_SERVER['HTTP_X_FILENAME'] ?? "evidence.{$info['ext']}"), 0, 120);
        $baseId = substr(trim(preg_replace('/[^a-z0-9]+/', '-', strtolower(pathinfo($filename, PATHINFO_FILENAME))), '-'), 0, 24) ?: 'ev';
        $id = $baseId;
        for ($n = 2; in_array($id, array_column($case['evidence'], 'id'), true); $n++) {
            $id = "$baseId-$n";
        }
        $key = $store->putBlob("evidence/{$case['ownerId']}/{$case['id']}", bin2hex(random_bytes(8)) . '.' . $info['ext'], $raw);
        $case['evidence'][] = [
            'id' => $id, 'filename' => $filename, 'mime' => $info['mime'], 'width' => $info['width'], 'height' => $info['height'],
            'chapter' => ($data['ch'] ?? '') ?: null, 'hero' => count($case['evidence']) === 0, 'confidential' => false, 'alt' => '', 'key' => $key,
        ];
        if (($case['chapters']['evidence']['state'] ?? '') === 'empty') {
            $case['chapters']['evidence']['state'] = 'in_progress';
        }
        $store->saveCase($case);
        json_out(200, ['id' => $id, 'width' => $info['width'], 'height' => $info['height']]);
    }
}

// Case file downloads, through signed links from close_case.
if (preg_match('#^/files/([A-Za-z0-9_.-]+)$#', $path, $m) && $method === 'GET') {
    $data = $auth->verify($m[1]);
    if (!$data || empty($data['k']) || empty($data['u']) || !str_starts_with($data['k'], "files/{$data['u']}/")) {
        respond(410, 'text/plain; charset=utf-8', 'This link expired. Close the case again for a new one.');
    }
    $name = str_replace('"', '', $data['f'] ?? 'case.zip');
    respond(200, 'application/zip', $store->readBlob($data['k']), ['Content-Disposition' => "attachment; filename=\"$name\""]);
}

respond(404, 'text/plain; charset=utf-8', 'Not found');
