<?php

namespace Tests\Unit;

use App\Enums\Square;
use PHPUnit\Framework\TestCase;

class SquareTest extends TestCase
{
    public function test_there_are_exactly_four_squares_a_to_d(): void
    {
        $this->assertSame(['a', 'b', 'c', 'd'], Square::values());
    }

    public function test_only_known_keys_can_be_built(): void
    {
        $this->assertSame(Square::B, Square::from('b'));
        $this->assertNull(Square::tryFrom('e'));
        $this->assertNull(Square::tryFrom('A'));
        $this->assertNull(Square::tryFrom(''));
    }
}
