<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Route;
use Tests\TestCase;

/**
 * Chat/alert endpoints do not exist yet, so these tests register throwaway
 * routes protected the same way the real ones will be (`can:<ability>`).
 */
class RoleEnforcementTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        Route::middleware(['api', 'auth:sanctum', 'can:start-alerts'])
            ->post('/api/_test/alerts', fn () => response()->json(['started' => true]));
        Route::middleware(['api', 'auth:sanctum', 'can:send-messages'])
            ->post('/api/_test/messages', fn () => response()->json(['sent' => true]));
    }

    public function test_visitor_gets_401(): void
    {
        $this->postJson('/api/_test/alerts')->assertUnauthorized();
    }

    public function test_regular_user_gets_403_on_an_admin_only_endpoint(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/api/_test/alerts')
            ->assertForbidden()
            ->assertJsonMissing(['started' => true]);
    }

    public function test_administrator_is_allowed_on_an_admin_only_endpoint(): void
    {
        $this->actingAs(User::factory()->administrator()->create())
            ->postJson('/api/_test/alerts')
            ->assertOk()
            ->assertJson(['started' => true]);
    }

    public function test_regular_user_is_allowed_on_a_shared_endpoint(): void
    {
        $this->actingAs(User::factory()->create())
            ->postJson('/api/_test/messages')
            ->assertOk();
    }

    public function test_role_in_a_login_request_does_not_matter(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password', 'role' => 'administrator'])
            ->assertOk()
            ->assertJsonPath('data.role', 'user');
    }

    public function test_user_signed_in_through_the_real_login_is_still_forbidden(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])->assertOk();
        $this->postJson('/api/_test/alerts')->assertForbidden();
    }
}
