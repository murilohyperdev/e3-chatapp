<?php

namespace Tests\Feature\Alerts;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * One scenario through the real HTTP endpoints: the whole life of an alert,
 * including what a session sees when it comes back after the end.
 */
class AlertLifecycleJourneyTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_alert_runs_from_start_to_end_is_restored_and_the_next_one_starts_empty(): void
    {
        $admin = User::factory()->administrator()->create();
        $first = User::factory()->create(['name' => 'Early Bird']);
        $late = User::factory()->create(['name' => 'Latecomer']);

        $alertId = $this->actingAs($admin)->postJson('/api/alerts')
            ->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->json('data.id');

        $this->actingAs($first)->postJson("/api/alerts/{$alertId}/responses", ['square' => 'c'])->assertCreated();

        $this->actingAs($admin)->postJson("/api/alerts/{$alertId}/end")
            ->assertOk()
            ->assertJsonPath('data.status', 'ended');

        // A session that was offline during the end asks for the current state.
        $this->actingAs($late)->getJson('/api/alerts/current')
            ->assertOk()
            ->assertJsonPath('data.id', $alertId)
            ->assertJsonPath('data.status', 'ended')
            ->assertJsonCount(1, 'data.responses')
            ->assertJsonPath('data.responses.0.user.name', 'Early Bird')
            ->assertJsonPath('data.responses.0.square', 'c');

        // Its late submission is refused and changes nothing.
        $this->actingAs($late)->postJson("/api/alerts/{$alertId}/responses", ['square' => 'a'])->assertConflict();
        $this->assertDatabaseCount('alert_responses', 1);

        // The next alert begins empty and the old one is untouched.
        $nextId = $this->actingAs($admin)->postJson('/api/alerts')
            ->assertCreated()
            ->assertJsonCount(0, 'data.responses')
            ->json('data.id');

        $this->assertNotSame($alertId, $nextId);
        $this->actingAs($late)->getJson('/api/alerts/current')
            ->assertJsonPath('data.id', $nextId)
            ->assertJsonPath('data.status', 'active')
            ->assertJsonCount(0, 'data.responses');
        $this->assertDatabaseHas('alert_responses', ['alert_id' => $alertId, 'user_id' => $first->id, 'square' => 'c']);

        // The user who missed the first alert can now answer the new one.
        $this->actingAs($late)->postJson("/api/alerts/{$nextId}/responses", ['square' => 'a'])->assertCreated();
    }
}
