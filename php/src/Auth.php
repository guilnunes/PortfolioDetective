<?php
declare(strict_types=1);

namespace PD;

/**
 * Personal tokens per friend (sent by Claude as a request header or, as a fallback,
 * in the connector URL), and signed short lived links for uploads and downloads.
 */
final class Auth
{
    /** @param array<string, array{id: string, name: string}> $users token => account */
    public function __construct(private array $users, private string $secret)
    {
        if (strlen($secret) < 32) {
            throw new \RuntimeException('secret must be at least 32 characters');
        }
    }

    public static function bearer(): ?string
    {
        $h = $_SERVER['HTTP_AUTHORIZATION'] ?? $_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '';
        if ($h === '' && function_exists('getallheaders')) {
            foreach (getallheaders() as $k => $v) {
                if (strtolower($k) === 'authorization') {
                    $h = $v;
                }
            }
        }
        if (preg_match('/^Bearer\s+(.+)$/i', trim($h), $m)) {
            return trim($m[1]);
        }
        // Fallback for hosts that strip the header: https://host/mcp?key=TOKEN
        return isset($_GET['key']) ? (string) $_GET['key'] : null;
    }

    public function account(?string $token): ?array
    {
        if ($token === null || $token === '') {
            return null;
        }
        foreach ($this->users as $t => $account) {
            if (hash_equals((string) $t, $token)) {
                return $account;
            }
        }
        return null;
    }

    public function sign(array $payload, int $ttl): string
    {
        $payload['exp'] = time() + $ttl;
        $body = rtrim(strtr(base64_encode(Json::encode($payload)), '+/', '-_'), '=');
        return $body . '.' . $this->mac($body);
    }

    public function verify(string $token): ?array
    {
        $parts = explode('.', $token);
        if (count($parts) !== 2 || !hash_equals($this->mac($parts[0]), $parts[1])) {
            return null;
        }
        $data = json_decode(base64_decode(strtr($parts[0], '-_', '+/')), true);
        if (!is_array($data) || ($data['exp'] ?? 0) < time()) {
            return null;
        }
        return $data;
    }

    private function mac(string $body): string
    {
        return rtrim(strtr(base64_encode(hash_hmac('sha256', $body, $this->secret, true)), '+/', '-_'), '=');
    }
}
