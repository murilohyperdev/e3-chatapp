<?php

namespace App\Enums;

enum UserRole: string
{
    case User = 'user';
    case Administrator = 'administrator';

    /**
     * Single source of truth for "who can do what".
     *
     * @return array<int, Ability>
     */
    public function abilities(): array
    {
        return match ($this) {
            self::User => [
                Ability::SendMessages,
                Ability::ReceiveAlerts,
                Ability::SubmitLocations,
                Ability::ViewLocations,
            ],
            // An administrator can do everything, including starting/ending alerts.
            self::Administrator => Ability::cases(),
        };
    }

    public function can(Ability $ability): bool
    {
        return in_array($ability, $this->abilities(), true);
    }
}
