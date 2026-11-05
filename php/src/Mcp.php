<?php
declare(strict_types=1);

namespace PD;

/**
 * Minimal stateless MCP server over Streamable HTTP: one JSON-RPC message per POST,
 * answered with application/json. Enough for Claude's custom connectors.
 */
final class Mcp
{
    private const VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

    public function __construct(private Tools $tools, private array $profile)
    {
    }

    /** @return array{0: int, 1: ?array} HTTP status and response body (null for notifications). */
    public function handle(array $msg): array
    {
        $id = $msg['id'] ?? null;
        $method = (string) ($msg['method'] ?? '');
        $params = (array) ($msg['params'] ?? []);
        if (!array_key_exists('id', $msg)) {
            return [202, null]; // notification, e.g. notifications/initialized
        }
        try {
            $result = match ($method) {
                'initialize' => $this->initialize($params),
                'ping' => new \stdClass(),
                'tools/list' => ['tools' => $this->tools->list()],
                'tools/call' => $this->tools->call((string) ($params['name'] ?? ''), (array) ($params['arguments'] ?? [])),
                'resources/list' => ['resources' => [self::viewResource()]],
                'resources/templates/list' => ['resourceTemplates' => []],
                'resources/read' => $this->read((string) ($params['uri'] ?? '')),
                'prompts/list' => ['prompts' => []],
                default => throw new \DomainException("Method not found: $method"),
            };
            return [200, ['jsonrpc' => '2.0', 'id' => $id, 'result' => $result]];
        } catch (\DomainException $e) {
            return [200, ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => -32601, 'message' => $e->getMessage()]]];
        } catch (\Throwable $e) {
            return [200, ['jsonrpc' => '2.0', 'id' => $id, 'error' => ['code' => -32603, 'message' => $e->getMessage()]]];
        }
    }

    private function initialize(array $params): array
    {
        $asked = (string) ($params['protocolVersion'] ?? '');
        return [
            'protocolVersion' => in_array($asked, self::VERSIONS, true) ? $asked : self::VERSIONS[1],
            'capabilities' => [
                'tools' => ['listChanged' => false],
                'resources' => ['listChanged' => false],
            ],
            'serverInfo' => ['name' => 'portfolio-detective', 'title' => 'Portfolio Detective', 'version' => '0.2.0'],
            'instructions' => Core::brief($this->profile['interfaceLanguage'], $this->profile['detectiveMode']),
        ];
    }

    private static function viewResource(): array
    {
        return [
            'uri' => Tools::VIEW_URI,
            'name' => 'darkroom',
            'title' => 'Portfolio Detective darkroom',
            'description' => 'Draws the Behance images of a case in the user\'s browser and files them.',
            'mimeType' => 'text/html;profile=mcp-app',
        ];
    }

    private function read(string $uri): array
    {
        if ($uri !== Tools::VIEW_URI) {
            throw new \DomainException("Unknown resource: $uri");
        }
        return ['contents' => [[
            'uri' => $uri,
            'mimeType' => 'text/html;profile=mcp-app',
            'text' => (string) file_get_contents(dirname(__DIR__) . '/resources/studio.html'),
            '_meta' => ['ui' => ['prefersBorder' => false]],
        ]]];
    }
}
