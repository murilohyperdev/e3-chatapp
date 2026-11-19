<?php

namespace Tests\Unit;

use App\Models\User;
use App\Policies\UserPolicy;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserPolicyTest extends TestCase
{
    use RefreshDatabase;

    public function test_only_the_owner_can_update_a_profile(): void
    {
        $owner = User::factory()->create();
        $other = User::factory()->create();
        $admin = User::factory()->administrator()->create();
        $policy = new UserPolicy;

        $this->assertTrue($policy->update($owner, $owner));
        $this->assertFalse($policy->update($other, $owner));
        $this->assertFalse($policy->update($admin, $owner));
    }

    public function test_profile_fields_are_fillable_but_sensitive_ones_are_not(): void
    {
        $user = new User;
        $user->fill(['name' => 'N', 'phone' => '1234567', 'address' => 'A', 'email' => 'x@y.z', 'role' => 'administrator', 'avatar_path' => 'p']);

        $this->assertSame('1234567', $user->phone);
        $this->assertNull($user->email);
        $this->assertNull($user->avatar_path);
        $this->assertSame('user', $user->role->value);
    }
}
