<?php

namespace App\Providers;

use App\Enums\Ability;
use App\Models\User;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        // One gate per ability, all answered by the user's role (UserRole::abilities()).
        foreach (Ability::cases() as $ability) {
            Gate::define($ability->value, fn (User $user): bool => $user->role->can($ability));
        }

        // The emailed reset link must open the React page, not a Laravel route.
        ResetPassword::createUrlUsing(function (object $user, string $token): string {
            return config('app.frontend_url').'/reset-password?'.http_build_query([
                'token' => $token,
                'email' => $user->getEmailForPasswordReset(),
            ]);
        });
    }
}
