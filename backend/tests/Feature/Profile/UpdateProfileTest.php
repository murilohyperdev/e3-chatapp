<?php

namespace Tests\Feature\Profile;

use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UpdateProfileTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_can_update_their_own_profile(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson("/api/users/{$user->id}", [
            'name' => 'Jane Doe',
            'phone' => '+55 (11) 91234-5678',
            'address' => '1 Main Street, Springfield',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Jane Doe')
            ->assertJsonPath('data.phone', '+55 (11) 91234-5678')
            ->assertJsonPath('data.address', '1 Main Street, Springfield');

        $this->assertSame('Jane Doe', $user->fresh()->name);
    }

    public function test_profile_fields_are_in_the_current_user_response(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->getJson('/api/user')
            ->assertOk()
            ->assertJsonPath('data.phone', null)
            ->assertJsonPath('data.address', null)
            ->assertJsonPath('data.avatar_url', null);
    }

    public function test_optional_fields_can_be_cleared(): void
    {
        $user = User::factory()->create();
        $user->update(['phone' => '123456789', 'address' => 'Somewhere']);

        $this->actingAs($user)->patchJson("/api/users/{$user->id}", ['phone' => null, 'address' => ''])
            ->assertOk()
            ->assertJsonPath('data.phone', null)
            ->assertJsonPath('data.address', null);
    }

    public function test_invalid_values_are_rejected_and_nothing_is_saved(): void
    {
        $user = User::factory()->create(['name' => 'Original']);

        $this->actingAs($user)->patchJson("/api/users/{$user->id}", [
            'name' => '',
            'phone' => 'call-me-maybe',
            'address' => str_repeat('a', 256),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['name', 'phone', 'address']);

        $this->assertSame('Original', $user->fresh()->name);
    }

    public function test_name_longer_than_100_characters_is_rejected(): void
    {
        $user = User::factory()->create();

        $this->actingAs($user)->patchJson("/api/users/{$user->id}", ['name' => str_repeat('n', 101)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('name');
    }

    public function test_email_and_role_in_the_payload_are_ignored(): void
    {
        $user = User::factory()->create(['email' => 'jane@example.com']);

        $this->actingAs($user)->patchJson("/api/users/{$user->id}", [
            'name' => 'Jane',
            'email' => 'hacker@example.com',
            'role' => 'administrator',
            'avatar_path' => 'avatars/evil.png',
        ])->assertOk();

        $fresh = $user->fresh();
        $this->assertSame('jane@example.com', $fresh->email);
        $this->assertSame(UserRole::User, $fresh->role);
        $this->assertNull($fresh->avatar_path);
    }

    public function test_user_cannot_edit_another_users_profile(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create(['name' => 'Other']);

        $this->actingAs($user)->patchJson("/api/users/{$other->id}", ['name' => 'Hacked'])
            ->assertForbidden();

        $this->assertSame('Other', $other->fresh()->name);
    }

    public function test_forbidden_comes_before_validation_errors(): void
    {
        $user = User::factory()->create();
        $other = User::factory()->create();

        $this->actingAs($user)->patchJson("/api/users/{$other->id}", ['name' => ''])
            ->assertForbidden();
    }

    public function test_administrator_cannot_edit_another_users_profile(): void
    {
        $admin = User::factory()->administrator()->create();
        $other = User::factory()->create(['name' => 'Other']);

        $this->actingAs($admin)->patchJson("/api/users/{$other->id}", ['name' => 'Changed by admin'])
            ->assertForbidden();

        $this->assertSame('Other', $other->fresh()->name);
    }

    public function test_visitor_gets_401(): void
    {
        $user = User::factory()->create();

        $this->patchJson("/api/users/{$user->id}", ['name' => 'Nope'])->assertUnauthorized();
    }

    public function test_unknown_user_is_a_404(): void
    {
        $this->actingAs(User::factory()->create())->patchJson('/api/users/999999', ['name' => 'X'])
            ->assertNotFound();
    }
}
