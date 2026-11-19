<?php

namespace Tests\Feature\Alerts;

use App\Models\Alert;
use App\Models\AlertResponse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class StartAlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrator_starts_an_alert(): void
    {
        $admin = User::factory()->administrator()->create(['name' => 'Ada']);

        $this->actingAs($admin)->postJson('/api/alerts')
            ->assertCreated()
            ->assertJsonPath('data.status', 'active')
            ->assertJsonPath('data.started_by.name', 'Ada')
            ->assertJsonPath('data.responses', [])
            ->assertJsonPath('data.revision', 1)
            ->assertJsonStructure(['data' => ['id', 'status', 'revision', 'started_at', 'ended_at', 'started_by' => ['id', 'name'], 'responses']]);

        $this->assertDatabaseCount('alerts', 1);
        $this->assertDatabaseHas('alerts', ['started_by' => $admin->id, 'ended_at' => null]);
    }

    public function test_regular_user_cannot_start_an_alert_by_direct_request(): void
    {
        $this->actingAs(User::factory()->create())->postJson('/api/alerts')->assertForbidden();

        $this->assertDatabaseCount('alerts', 0);
    }

    public function test_visitor_cannot_start_an_alert(): void
    {
        $this->postJson('/api/alerts')->assertUnauthorized();

        $this->assertDatabaseCount('alerts', 0);
    }

    public function test_a_second_active_alert_is_refused_and_the_first_is_untouched(): void
    {
        $admin = User::factory()->administrator()->create();
        $first = Alert::factory()->create();

        $this->actingAs($admin)->postJson('/api/alerts')->assertConflict();

        $this->assertDatabaseCount('alerts', 1);
        $this->assertNull($first->fresh()->ended_at);
    }

    public function test_a_new_alert_can_start_after_the_previous_one_ended_and_begins_empty(): void
    {
        $admin = User::factory()->administrator()->create();
        $old = Alert::factory()->ended()->create();
        AlertResponse::factory()->create(['alert_id' => $old->id, 'square' => 'a']);

        $response = $this->actingAs($admin)->postJson('/api/alerts')->assertCreated();

        $this->assertNotSame($old->id, $response->json('data.id'));
        $response->assertJsonPath('data.responses', []);
        $this->assertDatabaseCount('alerts', 2);
    }
}
