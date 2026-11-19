<?php

namespace Tests\Unit;

use App\Enums\Ability;
use App\Enums\UserRole;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Gate;
use Tests\TestCase;

class AbilityGatesTest extends TestCase
{
    use RefreshDatabase;

    private const SHARED = ['send-messages', 'receive-alerts', 'submit-locations', 'view-locations'];

    private const ADMIN_ONLY = ['start-alerts', 'end-alerts'];

    public function test_new_users_default_to_the_user_role(): void
    {
        $this->assertSame(UserRole::User, User::factory()->create()->fresh()->role);
        $this->assertSame(UserRole::User, (new User)->role);
    }

    public function test_regular_user_gets_shared_abilities_but_not_admin_ones(): void
    {
        $user = User::factory()->create();

        foreach (self::SHARED as $ability) {
            $this->assertTrue(Gate::forUser($user)->allows($ability), "user should be allowed $ability");
        }
        foreach (self::ADMIN_ONLY as $ability) {
            $this->assertTrue(Gate::forUser($user)->denies($ability), "user should be denied $ability");
        }
    }

    public function test_administrator_is_allowed_every_ability(): void
    {
        $admin = User::factory()->administrator()->create();

        foreach (Ability::cases() as $ability) {
            $this->assertTrue(Gate::forUser($admin)->allows($ability->value), "admin should be allowed {$ability->value}");
        }
        $this->assertTrue($admin->isAdministrator());
    }

    public function test_every_ability_is_covered_by_this_test(): void
    {
        $covered = [...self::SHARED, ...self::ADMIN_ONLY];
        $defined = array_map(fn (Ability $ability) => $ability->value, Ability::cases());

        $this->assertEqualsCanonicalizing($defined, $covered);
    }

    public function test_role_cannot_be_mass_assigned(): void
    {
        $user = User::factory()->create();

        $user->update(['name' => 'New Name', 'role' => 'administrator']);

        $this->assertSame('New Name', $user->fresh()->name);
        $this->assertSame(UserRole::User, $user->fresh()->role);
    }

    public function test_ability_map_lists_every_ability(): void
    {
        $map = User::factory()->create()->abilityMap();

        $this->assertCount(count(Ability::cases()), $map);
        $this->assertTrue($map['send-messages']);
        $this->assertFalse($map['start-alerts']);
    }
}
