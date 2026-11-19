<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SessionTest extends TestCase
{
    use RefreshDatabase;

    public function test_current_user_endpoint_returns_the_signed_in_user_without_secrets(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/user')
            ->assertOk()
            ->assertExactJson(['data' => ['id' => $user->id, 'name' => $user->name, 'email' => $user->email]]);
    }

    public function test_current_user_endpoint_rejects_visitors(): void
    {
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_user_can_sign_out(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);

        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])->assertOk();
        $this->postJson('/api/logout')->assertNoContent();

        // The `auth:sanctum` middleware switches the default guard, so check `web` explicitly.
        $this->assertGuest('web');
        $this->app['auth']->forgetGuards();
        $this->getJson('/api/user')->assertUnauthorized();
    }

    public function test_sign_out_requires_a_session(): void
    {
        $this->postJson('/api/logout')->assertUnauthorized();
    }

    public function test_session_id_changes_after_sign_in(): void
    {
        User::factory()->create(['email' => 'jane@example.com']);
        $this->startSession();
        $before = session()->getId();

        $this->postJson('/api/login', ['email' => 'jane@example.com', 'password' => 'password'])->assertOk();

        $this->assertNotSame($before, session()->getId());
    }
}
