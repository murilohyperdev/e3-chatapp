<?php

namespace Database\Factories;

use App\Enums\Square;
use App\Models\Alert;
use App\Models\AlertResponse;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AlertResponse>
 */
class AlertResponseFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'alert_id' => Alert::factory(),
            'user_id' => User::factory(),
            'square' => fake()->randomElement(Square::cases()),
        ];
    }
}
