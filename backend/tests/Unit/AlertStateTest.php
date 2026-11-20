<?php

namespace Tests\Unit;

use App\Models\Alert;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlertStateTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_alert_without_end_time_is_active(): void
    {
        $this->assertTrue((new Alert)->isActive());
    }

    public function test_an_alert_with_an_end_time_is_not_active(): void
    {
        $alert = new Alert;
        $alert->ended_at = now();

        $this->assertFalse($alert->isActive());
    }

    public function test_the_active_scope_agrees_with_is_active(): void
    {
        $active = Alert::factory()->create();
        Alert::factory()->ended()->create();

        $this->assertSame([$active->id], Alert::active()->pluck('id')->all());
        $this->assertTrue(Alert::active()->first()->isActive());
    }

    public function test_a_new_alert_starts_at_revision_one(): void
    {
        $this->assertSame(1, (new Alert)->revision);
    }
}
