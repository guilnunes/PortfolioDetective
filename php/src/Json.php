<?php
declare(strict_types=1);

namespace PD;

final class Json
{
    public static function encode(mixed $v): string
    {
        return json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }

    public static function pretty(mixed $v): string
    {
        return json_encode($v, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
    }

    public static function decode(string $s): mixed
    {
        return json_decode($s, true, 512, JSON_THROW_ON_ERROR);
    }
}
