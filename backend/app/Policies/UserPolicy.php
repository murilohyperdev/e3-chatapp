<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    /**
     * A profile can only be edited by its owner. Administrators are deliberately
     * not exempt: the requirement is that nobody edits another person's profile.
     */
    public function update(User $actor, User $target): bool
    {
        return $actor->is($target);
    }
}
