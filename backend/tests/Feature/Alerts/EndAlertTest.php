<?php

namespace Tests\Feature\Alerts;

use App\Models\Alert;
use App\Models\AlertResponse;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class EndAlertTest extends TestCase
{
    use RefreshDatabase;

    public function test_administrator_ends_the_alert_and_responses_are_kept(): void
    {
        $admin = User::factory()->administrator()->create();
        $alert = Alert::factory()->create();
        AlertResponse::factory()->create(['alert_id' => $alert->id, 'square' => 'b']);

        $this->actingAs($admin)->postJson("/api/alerts/{$alert->id}/end")
            ->assertOk()
            ->assertJsonPath('data.status', 'ended')
            ->assertJsonPath('data.revision', 2)
            ->assertJsonCount(1, 'data.responses');

        $this->assertDatabaseHas('alerts', ['id' => $alert->id, 'ended_by' => $admin->id]);
        $this->assertNotNull($alert->fresh()->ended_at);
    }

    public function test_ending_twice_is_refused_and_keeps_the_first_end_time(): void
    {
        $admin = User::factory()->administrator()->create();
        $alert = Alert::factory()->create();
        $this->actingAs($admin)->postJson("/api/alerts/{$alert->id}/end")->assertOk();
        $endedAt = $alert->fresh()->ended_at;

        $this->travel(5)->minutes();
        $this->actingAs($admin)->postJson("/api/alerts/{$alert->id}/end")->assertConflict();

        $this->assertTrue($endedAt->equalTo($alert->fresh()->ended_at));
    }

    public function test_regular_user_cannot_end_an_alert_by_direct_request(): void
    {
        $alert = Alert::factory()->create();

        $this->actingAs(User::factory()->create())->postJson("/api/alerts/{$alert->id}/end")->assertForbidden();

        $this->assertNull($alert->fresh()->ended_at);
    }

    public function test_visitor_gets_401(): void
    {
        $alert = Alert::factory()->create();

        $this->postJson("/api/alerts/{$alert->id}/end")->assertUnauthorized();
    }

    public function test_unknown_alert_is_404(): void
    {
        $this->actingAs(User::factory()->administrator()->create())->postJson('/api/alerts/999/end')->assertNotFound();
    }

    public function test_picks_after_the_end_are_rejected_and_a_new_alert_starts_empty(): void
    {
        $admin = User::factory()->administrator()->create();
        $user = User::factory()->create();
        $alert = Alert::factory()->create();
        $this->actingAs($user)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a'])->assertCreated();
        $this->actingAs($admin)->postJson("/api/alerts/{$alert->id}/end")->assertOk();

        $late = User::factory()->create();
        $this->actingAs($late)->postJson("/api/alerts/{$alert->id}/responses", ['square' => 'a'])->assertConflict();
        $this->assertDatabaseCount('alert_responses', 1);

        $this->actingAs($admin)->postJson('/api/alerts')->assertCreated()->assertJsonPath('data.responses', []);
    }
}
