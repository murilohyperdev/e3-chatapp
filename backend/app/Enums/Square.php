<?php

namespace App\Enums;

/**
 * The four places a person can say they are in. The server only knows the key
 * (`a` to `d`); the labels shown to people live in the frontend. The same four
 * values are enforced by a CHECK constraint on `alert_responses.square`.
 */
enum Square: string
{
    case A = 'a';
    case B = 'b';
    case C = 'c';
    case D = 'd';

    /**
     * @return array<int, string>
     */
    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
