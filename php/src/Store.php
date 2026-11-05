<?php
declare(strict_types=1);

namespace PD;

use PDO;

/**
 * Cases live as JSON in MySQL (SQLite for local tests). Images live on disk, outside the web root.
 */
final class Store
{
    private PDO $db;
    private bool $mysql;

    public function __construct(array $dbConfig, private string $storageDir)
    {
        $this->db = new PDO($dbConfig['dsn'], $dbConfig['user'] ?? null, $dbConfig['password'] ?? null, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
        $this->mysql = str_starts_with($dbConfig['dsn'], 'mysql:');
        if ($this->mysql) {
            $this->db->exec("SET NAMES utf8mb4");
        }
        $this->migrate();
    }

    private function migrate(): void
    {
        $text = $this->mysql ? 'LONGTEXT' : 'TEXT';
        $this->db->exec("CREATE TABLE IF NOT EXISTS pd_users (id VARCHAR(64) NOT NULL PRIMARY KEY, profile $text NOT NULL)");
        $this->db->exec("CREATE TABLE IF NOT EXISTS pd_cases (owner_id VARCHAR(64) NOT NULL, id VARCHAR(64) NOT NULL, data $text NOT NULL, updated_at VARCHAR(40) NOT NULL, PRIMARY KEY (owner_id, id))");
    }

    private function upsert(string $table, array $keys, array $values): void
    {
        $cols = array_merge(array_keys($keys), array_keys($values));
        $marks = implode(',', array_fill(0, count($cols), '?'));
        $sets = implode(',', array_map(
            fn($c) => $this->mysql ? "$c = VALUES($c)" : "$c = excluded.$c",
            array_keys($values)
        ));
        $sql = "INSERT INTO $table (" . implode(',', $cols) . ") VALUES ($marks) "
            . ($this->mysql ? "ON DUPLICATE KEY UPDATE $sets" : "ON CONFLICT(" . implode(',', array_keys($keys)) . ") DO UPDATE SET $sets");
        $this->db->prepare($sql)->execute(array_merge(array_values($keys), array_values($values)));
    }

    public function getUser(string $id): ?array
    {
        $st = $this->db->prepare('SELECT profile FROM pd_users WHERE id = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        return $row ? json_decode($row['profile'], true) : null;
    }

    public function saveUser(array $profile): void
    {
        $this->upsert('pd_users', ['id' => $profile['id']], ['profile' => Json::encode($profile)]);
    }

    public function listCases(string $ownerId): array
    {
        $st = $this->db->prepare('SELECT data FROM pd_cases WHERE owner_id = ? ORDER BY updated_at DESC');
        $st->execute([$ownerId]);
        return array_map(fn($r) => json_decode($r['data'], true), $st->fetchAll());
    }

    public function getCase(string $ownerId, string $id): ?array
    {
        $st = $this->db->prepare('SELECT data FROM pd_cases WHERE owner_id = ? AND id = ?');
        $st->execute([$ownerId, $id]);
        $row = $st->fetch();
        return $row ? json_decode($row['data'], true) : null;
    }

    public function saveCase(array $case): void
    {
        $case['updatedAt'] = gmdate('c');
        $this->upsert('pd_cases', ['owner_id' => $case['ownerId'], 'id' => $case['id']], [
            'data' => Json::encode($case),
            'updated_at' => $case['updatedAt'],
        ]);
    }

    private static function safe(string $s): string
    {
        if (!preg_match('/^[A-Za-z0-9_-]+$/', $s)) {
            throw new \InvalidArgumentException("Invalid id: $s");
        }
        return $s;
    }

    private function path(string $key): string
    {
        if (str_contains($key, '..') || !preg_match('#^[A-Za-z0-9_/.-]+$#', $key)) {
            throw new \InvalidArgumentException('Invalid storage key');
        }
        if (str_starts_with($key, 'fixtures/')) {
            return dirname(__DIR__) . '/' . $key;
        }
        return rtrim($this->storageDir, '/') . '/' . $key;
    }

    /** Stores a file under prefix/name. Every prefix segment must be a safe id. */
    public function putBlob(string $prefix, string $name, string $data): string
    {
        if (!preg_match('/^[A-Za-z0-9_-]+\.[a-z0-9]{1,5}$/', $name)) {
            throw new \InvalidArgumentException("Invalid file name: $name");
        }
        $key = implode('/', array_map([self::class, 'safe'], explode('/', $prefix))) . '/' . $name;
        $file = $this->path($key);
        if (!is_dir(dirname($file))) {
            mkdir(dirname($file), 0750, true);
        }
        file_put_contents($file, $data);
        return $key;
    }

    public function readBlob(string $key): string
    {
        $data = @file_get_contents($this->path($key));
        if ($data === false) {
            throw new \RuntimeException("Missing file: $key");
        }
        return $data;
    }

    public function storageDir(): string
    {
        return $this->storageDir;
    }
}
