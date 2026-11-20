<?php

namespace Tests\Unit;

use App\Enums\Ability;
use App\Enums\UserRole;
use PHPUnit\Framework\TestCase;

class UserRoleTest extends TestCase
{
    public function test_a_regular_user_cannot_start_or_end_alerts(): void
    {
        $this->assertFalse(UserRole::User->can(Ability::StartAlerts));
        $this->assertFalse(UserRole::User->can(Ability::EndAlerts));
    }

    public function test_a_regular_user_keeps_the_four_shared_abilities(): void
    {
        foreach ([Ability::SendMessages, Ability::ReceiveAlerts, Ability::SubmitLocations, Ability::ViewLocations] as $ability) {
            $this->assertTrue(UserRole::User->can($ability));
        }
    }

    public function test_an_administrator_holds_a_superset_of_the_user_abilities(): void
    {
        $this->assertSame([], array_diff(
            array_column(UserRole::User->abilities(), 'value'),
            array_column(UserRole::Administrator->abilities(), 'value'),
        ));
        $this->assertTrue(UserRole::Administrator->can(Ability::StartAlerts));
        $this->assertTrue(UserRole::Administrator->can(Ability::EndAlerts));
    }

    public function test_unknown_role_values_are_rejected(): void
    {
        $this->assertNull(UserRole::tryFrom('owner'));
    }
}
